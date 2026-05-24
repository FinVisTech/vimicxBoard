import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskComments } from "@/components/TaskComments";
import { TaskPrioritySelect } from "@/components/TaskPrioritySelect";
import { TaskArchiveActions } from "@/components/TaskArchiveActions";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      assignee: true,
      column: true,
      comments: { include: { user: true }, orderBy: { createdAt: "desc" } }
    }
  });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/board" className="text-sm font-semibold text-primary">
        Back to board
      </Link>
      <section className="mt-5 rounded-lg border border-border bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">{task.column.name}</p>
            <h1 className="mt-1 text-3xl font-bold">{task.title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TaskPrioritySelect taskId={task.id} initialPriority={task.priority} />
            <TaskArchiveActions taskId={task.id} isArchived={Boolean(task.archivedAt)} />
          </div>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Owner" value={task.assignee?.name ?? "Unassigned"} />
          <Field label="Due" value={task.dueDate ? task.dueDate.toLocaleDateString() : "No due date"} />
          <Field label="Source" value={task.source} />
          <Field label="Last Updated" value={task.updatedAt.toLocaleString()} />
          <Field label="Archive Status" value={task.archivedAt ? `Archived ${task.archivedAt.toLocaleString()}` : "Active"} />
        </div>
        {task.description ? <p className="mt-6 leading-7 text-slate-700">{task.description}</p> : null}
        {task.isBlocked ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Blocked:</strong> {task.blockerReason ?? "No reason provided."}
          </div>
        ) : null}
      </section>
      <TaskComments taskId={task.id} initialComments={JSON.parse(JSON.stringify(task.comments))} />
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
