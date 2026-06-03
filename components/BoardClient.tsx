"use client";

import {
  DndContext,
  PointerSensor,
  closestCorners,
  type DragEndEvent,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Bot, Check, CheckCircle2, ChevronDown, Clock, Mail, MessageSquare, Pencil, Plus, Radio, Save, UserRound, X } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Assignee = { user: { id: string; name: string } };
type Acceptance = {
  status: "PENDING" | "ACCEPTED" | "NEEDS_CLARIFICATION" | "REJECTED";
  user: { id: string; name: string; discordUserId?: string | null };
};
type User = { id: string; name: string; discordUserId?: string | null };
type Task = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  isBlocked: boolean;
  source: "WEB" | "DISCORD" | "SLACK" | "AGENT";
  updatedAt: string;
  assignees: Assignee[];
  acceptances: Acceptance[];
  columnId: string;
};
type Column = { id: string; name: string; position: number; tasks: Task[] };
type Board = { id: string; name: string; columns: Column[] };
type Priority = Task["priority"];

const priorityStyle = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-100 text-sky-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700"
};

const priorityRank: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const byPriority = (a: Task, b: Task) => priorityRank[a.priority] - priorityRank[b.priority];

export function BoardClient({ board, allUsers }: { board: Board; allUsers: User[] }) {
  const [columns, setColumns] = useState(board.columns);
  const [isHydrated, setIsHydrated] = useState(false);
  const [personFilter, setPersonFilter] = useState<string>("all");
  const columnById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const allPeople = useMemo(
    () => [...allUsers].sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers]
  );

  const filteredColumns = useMemo(() => {
    if (personFilter === "all") return columns;
    return columns.map((col) => ({
      ...col,
      tasks:
        personFilter === "unassigned"
          ? col.tasks.filter((t) => t.assignees.length === 0)
          : col.tasks.filter((t) => t.assignees.some((a) => a.user.id === personFilter))
    }));
  }, [columns, personFilter]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    setColumns(board.columns);
  }, [board.columns]);

  useEffect(() => {
    const controller = new AbortController();

    async function refreshBoardSnapshot() {
      try {
        const response = await fetch(`/api/boards/${board.id}`, {
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) return;
        const latestBoard = (await response.json()) as Board;
        setColumns(latestBoard.columns);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }

    refreshBoardSnapshot();

    return () => {
      controller.abort();
    };
  }, [board.id]);

  async function onDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id);
    const columnId = event.over?.id ? String(event.over.id) : null;
    if (!columnId || !columnById.has(columnId)) return;
    const currentColumnId = columns.find((column) => column.tasks.some((task) => task.id === taskId))?.id;
    if (currentColumnId === columnId) return;

    const targetColumn = columnById.get(columnId)!;
    setColumns((current) =>
      current.map((column) => {
        const moving = column.tasks.find((task) => task.id === taskId);
        if (moving) {
          return { ...column, tasks: column.tasks.filter((task) => task.id !== taskId) };
        }
        if (column.id === columnId) {
          const task = current.flatMap((item) => item.tasks).find((item) => item.id === taskId);
          return task ? { ...column, tasks: [{ ...task, columnId }, ...column.tasks] } : column;
        }
        return column;
      })
    );

    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnName: targetColumn.name, source: "WEB" })
    });
  }

  if (!isHydrated) {
    return (
      <>
        <BoardHeader columns={columns} onTaskCreated={addTaskToColumn} allPeople={allPeople} personFilter={personFilter} onPersonFilterChange={setPersonFilter} />
        <BoardGrid columns={filteredColumns} isInteractive={false} onTaskUpdated={updateTaskInColumns} />
      </>
    );
  }

  return (
    <>
      <BoardHeader columns={columns} onTaskCreated={addTaskToColumn} allPeople={allPeople} personFilter={personFilter} onPersonFilterChange={setPersonFilter} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <BoardGrid columns={filteredColumns} isInteractive onTaskUpdated={updateTaskInColumns} />
      </DndContext>
    </>
  );

  function addTaskToColumn(task: Task) {
    setColumns((current) =>
      current.map((column) => (column.id === task.columnId ? { ...column, tasks: [task, ...column.tasks] } : column))
    );
  }

  function updateTaskInColumns(updatedTask: Task) {
    setColumns((current) =>
      current.map((column) => ({
        ...column,
        tasks: column.tasks.map((task) =>
          task.id === updatedTask.id
            ? {
                ...task,
                ...updatedTask,
                columnId: updatedTask.columnId ?? task.columnId
              }
            : task
        )
      }))
    );
  }
}

function BoardHeader({
  columns,
  onTaskCreated,
  allPeople,
  personFilter,
  onPersonFilterChange
}: {
  columns: Column[];
  onTaskCreated: (task: Task) => void;
  allPeople: User[];
  personFilter: string;
  onPersonFilterChange: (value: string) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const selectedLabel =
    personFilter === "all"
      ? "All People"
      : personFilter === "unassigned"
        ? "Unassigned"
        : allPeople.find((p) => p.id === personFilter)?.name ?? "All People";

  const options = [
    { id: "all", label: "All People" },
    { id: "unassigned", label: "Unassigned" },
    ...allPeople.map((p) => ({ id: p.id, label: p.name }))
  ];

  return (
    <div className="mb-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Filter by person</p>
          <div ref={dropdownRef} className="relative inline-block">
            <button
              type="button"
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <UserRound className="h-4 w-4 text-primary" />
              {selectedLabel}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <ul className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                {options.map((opt) => (
                  <li key={opt.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); onPersonFilterChange(opt.id); setDropdownOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                        personFilter === opt.id
                          ? "bg-primary text-white"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex w-full flex-col items-stretch gap-2 lg:w-[600px] lg:items-end">
          <AddTaskPanel columns={columns} allPeople={allPeople} onTaskCreated={onTaskCreated} />
          <p className="text-sm leading-6 text-slate-600">
            Mention <span className="font-semibold">@board</span> in Discord to add, move, assign, query, or summarize work.
          </p>
        </div>
      </div>
    </div>
  );
}

function AddTaskPanel({ columns, allPeople, onTaskCreated }: { columns: Column[]; allPeople: User[]; onTaskCreated: (task: Task) => void }) {
  const defaultColumnName = columns.find((column) => column.name === "To Do")?.name ?? columns[0]?.name ?? "To Do";
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignees, setAssignees] = useState<User[]>([]);
  const [dmAssignees, setDmAssignees] = useState<User[]>([]);
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [columnName, setColumnName] = useState(defaultColumnName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const ownerIds = new Set(assignees.map((user) => user.id));
    setDmAssignees((current) => current.filter((user) => ownerIds.has(user.id)));
  }, [assignees]);

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (title.trim().length < 2) {
      setError("Add a task title first.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description.trim() || null,
          assigneeIds: assignees.map((user) => user.id),
          dmUserIds: dmAssignees.map((user) => user.id),
          priority,
          columnName,
          source: "WEB"
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const task = (await response.json()) as Task;
      onTaskCreated(task);
      setTitle("");
      setDescription("");
      setAssignees([]);
      setDmAssignees([]);
      setPriority("MEDIUM");
      setColumnName(defaultColumnName);
      setIsOpen(false);
    } catch {
      setError("Could not create that task.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-full max-w-[210px] items-center justify-center gap-2 rounded-md border border-primary bg-white px-4 text-sm font-semibold text-primary shadow-sm transition hover:bg-teal-50 lg:self-end"
      >
        <Plus className="h-4 w-4" />
        Add Task
      </button>
    );
  }

  return (
    <form onSubmit={submitTask} className="w-full rounded-lg border border-primary bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Add Task</h2>
          <p className="mt-1 text-sm text-slate-600">Manual fallback for when Discord capture is unavailable.</p>
        </div>
        <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100" aria-label="Close add task form">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          Title
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs to get done?" autoFocus />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-slate-600">
          Details
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Notes, acceptance criteria, links, or context" />
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <AddTaskOwnerPicker assignees={assignees} users={allPeople} disabled={isSaving} onChange={setAssignees} />
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Priority
            <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25">
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
              <option value="URGENT">URGENT</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Column
            <select value={columnName} onChange={(event) => setColumnName(event.target.value)} className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25">
              {columns.map((column) => (
                <option key={column.id} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-start-3">
            <AddTaskDmPicker dmAssignees={dmAssignees} owners={assignees} disabled={isSaving} onChange={setDmAssignees} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isSaving} className="h-12 gap-2 px-6 text-base">
          <Save className="h-5 w-5" />
          Create Task
        </Button>
        {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      </div>
    </form>
  );
}

function AddTaskDmPicker({
  dmAssignees,
  owners,
  disabled,
  onChange
}: {
  dmAssignees: User[];
  owners: User[];
  disabled: boolean;
  onChange: (assignees: User[]) => void;
}) {
  const selectedIds = new Set(dmAssignees.map((user) => user.id));

  function toggleOwner(user: User) {
    if (!user.discordUserId || disabled) return;
    if (selectedIds.has(user.id)) {
      onChange(dmAssignees.filter((assignee) => assignee.id !== user.id));
      return;
    }
    onChange([...dmAssignees, user]);
  }

  return (
    <div className="grid gap-1 text-sm font-semibold text-slate-600">
      DM owners
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1.5">
        {owners.length === 0 ? (
          <span className="px-1 text-sm font-semibold text-slate-400">Add owners first</span>
        ) : null}
        {owners.map((user) => {
          const selected = selectedIds.has(user.id);
          const canDm = Boolean(user.discordUserId);
          return (
            <button
              key={user.id}
              type="button"
              onClick={() => toggleOwner(user)}
              disabled={disabled || !canDm}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                selected
                  ? "border-primary bg-teal-50 text-primary"
                  : "border-border bg-slate-50 text-slate-600 hover:border-primary hover:text-primary"
              }`}
              title={canDm ? undefined : "No Discord user ID mapped"}
            >
              <Mail className="h-3 w-3" />
              {user.name}
              {selected ? <Check className="h-3 w-3" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddTaskOwnerPicker({
  assignees,
  users,
  disabled,
  onChange
}: {
  assignees: User[];
  users: User[];
  disabled: boolean;
  onChange: (assignees: User[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(assignees.map((user) => user.id));
  const filtered = users.filter(
    (user) => !assignedIds.has(user.id) && (query.trim().length === 0 || user.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (adding) {
      setQuery("");
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [adding]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAdding(false);
      }
    }

    if (adding) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [adding]);

  function addAssignee(user: User) {
    setAdding(false);
    onChange([...assignees, user]);
  }

  function removeAssignee(userId: string) {
    onChange(assignees.filter((user) => user.id !== userId));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[highlighted]) addAssignee(filtered[highlighted]);
    } else if (event.key === "Escape") {
      setAdding(false);
    }
  }

  return (
    <div className="grid gap-1 text-sm font-semibold text-slate-600">
      Owner
      <div className="relative" ref={dropdownRef}>
        <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border bg-white px-2 py-1.5">
          {assignees.length === 0 && !adding ? (
            <span className="px-1 text-sm font-semibold text-slate-400">Unassigned</span>
          ) : null}
          {assignees.map((user) => (
            <span
              key={user.id}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"
            >
              <UserRound className="h-3 w-3 text-slate-400" />
              {user.name}
              <button
                type="button"
                onClick={() => removeAssignee(user.id)}
                disabled={disabled}
                className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 disabled:opacity-50"
                aria-label={`Remove ${user.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {!adding ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              disabled={disabled || assignees.length === users.length}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2 py-1 text-xs font-semibold text-slate-400 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              Add
            </button>
          ) : null}
        </div>

        {adding ? (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setHighlighted(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search team members..."
              disabled={disabled}
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
            />
            {filtered.length > 0 ? (
              <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
                {filtered.map((user, index) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        addAssignee(user);
                      }}
                      onMouseEnter={() => setHighlighted(index)}
                      className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                        index === highlighted ? "bg-primary text-white" : "text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {user.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
                <p className="text-sm text-slate-400">
                  {assignees.length === users.length
                    ? "All team members already assigned."
                    : "No match - only team members in Settings can be assigned."}
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function BoardGrid({
  columns,
  isInteractive,
  onTaskUpdated
}: {
  columns: Column[];
  isInteractive: boolean;
  onTaskUpdated: (task: Task) => void;
}) {
  return (
    <div className="grid min-h-[calc(100vh-145px)] grid-cols-1 gap-4 overflow-x-auto pb-6 md:grid-cols-5">
      {columns.map((column) => (
        isInteractive ? <ColumnDrop key={column.id} column={column} onTaskUpdated={onTaskUpdated} /> : <StaticColumn key={column.id} column={column} />
      ))}
    </div>
  );
}

function ColumnDrop({ column, onTaskUpdated }: { column: Column; onTaskUpdated: (task: Task) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section ref={setNodeRef} id={column.id} className={getColumnClassName(isOver)}>
      <ColumnHeader column={column} />
      <div className="min-h-24 space-y-3" data-droppable-id={column.id}>
        {[...column.tasks].sort(byPriority).map((task) => (
          <TaskCard key={task.id} task={task} onTaskUpdated={onTaskUpdated} />
        ))}
      </div>
    </section>
  );
}

function StaticColumn({ column }: { column: Column }) {
  return (
    <section id={column.id} className={getColumnClassName(false)}>
      <ColumnHeader column={column} />
      <div className="min-h-24 space-y-3" data-droppable-id={column.id}>
        {[...column.tasks].sort(byPriority).map((task) => (
          <StaticTaskCard key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}

function ColumnHeader({ column }: { column: Column }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-base font-semibold">{column.name}</h2>
      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-500">{column.tasks.length}</span>
    </div>
  );
}

function getColumnClassName(isOver: boolean) {
  return isOver
    ? "rounded-lg border border-teal-300 bg-teal-50 p-3 transition-colors"
    : "rounded-lg border border-border bg-slate-50 p-3 transition-colors";
}

function TaskCard({ task, onTaskUpdated }: { task: Task; onTaskUpdated: (task: Task) => void }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <article ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab rounded-lg border border-border bg-card p-4 shadow-sm">
      <TaskCardBody task={task} onTaskUpdated={onTaskUpdated} />
    </article>
  );
}

function StaticTaskCard({ task }: { task: Task }) {
  return (
    <article className="rounded-lg border border-border bg-card p-4 shadow-sm">
      <TaskCardBody task={task} />
    </article>
  );
}

function TaskCardBody({ task, onTaskUpdated }: { task: Task; onTaskUpdated?: (task: Task) => void }) {
  const SourceIcon = task.source === "DISCORD" ? MessageSquare : task.source === "AGENT" ? Bot : task.source === "SLACK" ? Radio : CheckCircle2;

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        {onTaskUpdated ? (
          <EditableTaskTitle task={task} onTaskUpdated={onTaskUpdated} />
        ) : (
          <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/25">
            <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
          </Link>
        )}
        {task.isBlocked ? <AlertTriangle className="h-5 w-5 shrink-0 text-danger" /> : null}
      </div>
      <Link href={`/tasks/${task.id}`} className="block rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/25">
        <div className="flex flex-wrap gap-2 text-xs font-semibold">
          <span className={priorityStyle[task.priority] + " rounded-full px-2 py-1"}>{task.priority}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            <UserRound className="h-3.5 w-3.5" />
            {task.assignees.length > 0 ? task.assignees.map((a) => a.user.name).join(", ") : "Unassigned"}
          </span>
          {task.dueDate ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
              <Clock className="h-3.5 w-3.5" />
              {new Date(task.dueDate).toLocaleDateString()}
            </span>
          ) : null}
        </div>
        <AcceptanceBadges acceptances={task.acceptances} />
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <SourceIcon className="h-3.5 w-3.5" />
            {task.source}
          </span>
          <span>{formatDistanceToNow(new Date(task.updatedAt), { addSuffix: true })}</span>
        </div>
      </Link>
    </div>
  );
}

function EditableTaskTitle({ task, onTaskUpdated }: { task: Task; onTaskUpdated: (task: Task) => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) setDraft(task.title);
  }, [isEditing, task.title]);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  async function saveTitle() {
    const nextTitle = draft.trim();
    if (nextTitle === task.title) {
      setIsEditing(false);
      setError(null);
      return;
    }

    if (nextTitle.length < 2) {
      setError("Use at least 2 characters.");
      return;
    }

    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: nextTitle, source: "WEB" })
    });

    setIsSaving(false);
    if (!response.ok) {
      setError("Could not save.");
      return;
    }

    const updatedTask = (await response.json()) as Task;
    onTaskUpdated(updatedTask);
    setIsEditing(false);
  }

  function cancelEdit() {
    setDraft(task.title);
    setIsEditing(false);
    setError(null);
  }

  if (isEditing) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void saveTitle();
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
        className="min-w-0 flex-1"
      >
        <div className="flex items-start gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") cancelEdit();
            }}
            disabled={isSaving}
            className="min-h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-2.5 py-1.5 text-base font-semibold leading-snug outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-primary transition hover:bg-teal-50 disabled:opacity-50"
            aria-label="Save task title"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={cancelEdit}
            disabled={isSaving}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="Cancel title edit"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {error ? <p className="mt-1 text-xs font-semibold text-red-600">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="group/title flex min-w-0 flex-1 items-start gap-1.5">
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 rounded-sm focus:outline-none focus:ring-2 focus:ring-primary/25">
        <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
      </Link>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsEditing(true);
        }}
        onPointerDown={(event) => event.stopPropagation()}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 opacity-100 transition hover:bg-slate-100 hover:text-slate-700 sm:opacity-0 sm:group-hover/title:opacity-100 sm:focus:opacity-100"
        aria-label="Edit task title"
        title="Edit title"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function AcceptanceBadges({ acceptances }: { acceptances: Acceptance[] }) {
  if (!acceptances || acceptances.length === 0) return null;

  const pending = acceptances.filter((acceptance) => acceptance.status === "PENDING");
  const needsClarification = acceptances.filter((acceptance) => acceptance.status === "NEEDS_CLARIFICATION");
  const rejected = acceptances.filter((acceptance) => acceptance.status === "REJECTED");
  const allAccepted = acceptances.length > 0 && acceptances.every((acceptance) => acceptance.status === "ACCEPTED");

  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
      {needsClarification.map((acceptance) => (
        <span key={acceptance.user.id} className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-red-700">
          Needs clarity: {acceptance.user.name}
        </span>
      ))}
      {pending.map((acceptance) => (
        <span key={acceptance.user.id} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
          Awaiting {acceptance.user.name}
        </span>
      ))}
      {rejected.map((acceptance) => (
        <span key={acceptance.user.id} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-slate-700">
          Not accepted: {acceptance.user.name}
        </span>
      ))}
      {allAccepted ? (
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">
          Owners accepted
        </span>
      ) : null}
    </div>
  );
}
