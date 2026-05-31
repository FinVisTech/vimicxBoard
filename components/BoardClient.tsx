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
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Clock, MessageSquare, Plus, Radio, Save, UserRound, X } from "lucide-react";
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

export function BoardClient({ board, allUsers }: { board: Board; allUsers: { id: string; name: string }[] }) {
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
        <BoardGrid columns={filteredColumns} isInteractive={false} />
      </>
    );
  }

  return (
    <>
      <BoardHeader columns={columns} onTaskCreated={addTaskToColumn} allPeople={allPeople} personFilter={personFilter} onPersonFilterChange={setPersonFilter} />
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
        <BoardGrid columns={filteredColumns} isInteractive />
      </DndContext>
    </>
  );

  function addTaskToColumn(task: Task) {
    setColumns((current) =>
      current.map((column) => (column.id === task.columnId ? { ...column, tasks: [task, ...column.tasks] } : column))
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
  allPeople: { id: string; name: string }[];
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
          <AddTaskPanel columns={columns} onTaskCreated={onTaskCreated} />
          <p className="text-sm leading-6 text-slate-600">
            Mention <span className="font-semibold">@board</span> in Discord to add, move, assign, query, or summarize work.
          </p>
        </div>
      </div>
    </div>
  );
}

function AddTaskPanel({ columns, onTaskCreated }: { columns: Column[]; onTaskCreated: (task: Task) => void }) {
  const defaultColumnName = columns.find((column) => column.name === "To Do")?.name ?? columns[0]?.name ?? "To Do";
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeName, setAssigneeName] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [columnName, setColumnName] = useState(defaultColumnName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
          assigneeName: assigneeName.trim() || null,
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
      setAssigneeName("");
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
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Owner
            <Input value={assigneeName} onChange={(event) => setAssigneeName(event.target.value)} placeholder="Luke, Dalton, etc." />
          </label>
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

function BoardGrid({ columns, isInteractive }: { columns: Column[]; isInteractive: boolean }) {
  return (
    <div className="grid min-h-[calc(100vh-145px)] grid-cols-1 gap-4 overflow-x-auto pb-6 md:grid-cols-5">
      {columns.map((column) => (
        isInteractive ? <ColumnDrop key={column.id} column={column} /> : <StaticColumn key={column.id} column={column} />
      ))}
    </div>
  );
}

function ColumnDrop({ column }: { column: Column }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section ref={setNodeRef} id={column.id} className={getColumnClassName(isOver)}>
      <ColumnHeader column={column} />
      <div className="min-h-24 space-y-3" data-droppable-id={column.id}>
        {[...column.tasks].sort(byPriority).map((task) => (
          <TaskCard key={task.id} task={task} />
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

function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <article ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab rounded-lg border border-border bg-card p-4 shadow-sm">
      <TaskCardBody task={task} />
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

function TaskCardBody({ task }: { task: Task }) {
  const SourceIcon = task.source === "DISCORD" ? MessageSquare : task.source === "AGENT" ? Bot : task.source === "SLACK" ? Radio : CheckCircle2;

  return (
    <Link href={`/tasks/${task.id}`} className="block">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-base font-semibold leading-snug">{task.title}</h3>
        {task.isBlocked ? <AlertTriangle className="h-5 w-5 shrink-0 text-danger" /> : null}
      </div>
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
