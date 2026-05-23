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
import { AlertTriangle, Bot, CheckCircle2, Clock, MessageSquare, Radio, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type User = { id: string; name: string } | null;
type Task = {
  id: string;
  title: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate: string | null;
  isBlocked: boolean;
  source: "WEB" | "DISCORD" | "SLACK" | "AGENT";
  updatedAt: string;
  assignee: User;
  columnId: string;
};
type Column = { id: string; name: string; position: number; tasks: Task[] };
type Board = { id: string; name: string; columns: Column[] };

const priorityStyle = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-sky-100 text-sky-700",
  HIGH: "bg-amber-100 text-amber-700",
  URGENT: "bg-red-100 text-red-700"
};

export function BoardClient({ board }: { board: Board }) {
  const [columns, setColumns] = useState(board.columns);
  const [isHydrated, setIsHydrated] = useState(false);
  const columnById = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => {
    setIsHydrated(true);
  }, []);

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
    return <BoardGrid columns={columns} isInteractive={false} />;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <BoardGrid columns={columns} isInteractive />
    </DndContext>
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
        {column.tasks.map((task) => (
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
        {column.tasks.map((task) => (
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
          {task.assignee?.name ?? "Unassigned"}
        </span>
        {task.dueDate ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-600">
            <Clock className="h-3.5 w-3.5" />
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        ) : null}
      </div>
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
