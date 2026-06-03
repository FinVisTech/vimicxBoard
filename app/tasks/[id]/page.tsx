import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskComments } from "@/components/TaskComments";
import { TaskPrioritySelect } from "@/components/TaskPrioritySelect";
import { TaskArchiveActions } from "@/components/TaskArchiveActions";
import { TaskDueDatePicker } from "@/components/TaskDueDatePicker";
import { TaskOwnerField } from "@/components/TaskOwnerField";
import { formatDistanceToNow } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [task, users] = await Promise.all([
    prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        assignees: { include: { user: true } },
        acceptances: { include: { user: true }, orderBy: { requestedAt: "asc" } },
        column: true,
        comments: { include: { user: true }, orderBy: { createdAt: "desc" } }
      }
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } })
  ]);

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
          <div className="grid w-full max-w-[304px] grid-cols-2 gap-3 sm:w-[304px]">
            <TaskDueDatePicker taskId={task.id} initialDueDate={task.dueDate ? task.dueDate.toISOString() : null} />
            <TaskPrioritySelect taskId={task.id} initialPriority={task.priority} />
            <TaskStatusBadge status={formatTaskStatus(task.column.name, task.completedAt)} />
            <TaskArchiveActions taskId={task.id} isArchived={Boolean(task.archivedAt)} />
          </div>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <TaskOwnerField
            taskId={task.id}
            initialAssignees={task.assignees.map((a) => a.user)}
            users={users}
          />
          <Field label="Source" value={task.source} />
          <Field label="Last Updated" value={task.updatedAt.toLocaleString()} />
          <Field
            label="Last Progressed"
            value={
              task.lastProgressedAt
                ? `${formatDistanceToNow(task.lastProgressedAt, { addSuffix: true })} · ${task.lastProgressedAt.toLocaleString()}`
                : "Not moved yet"
            }
          />
        </div>
        <AcceptancePanel acceptances={task.acceptances} />
        {task.description ? <p className="mt-6 leading-7 text-slate-700">{task.description}</p> : null}
        {task.isBlocked ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Blocked:</strong> {task.blockerReason ?? "No reason provided."}
          </div>
        ) : null}
      </section>
      <TaskComments
        taskId={task.id}
        initialComments={JSON.parse(JSON.stringify(task.comments))}
        initialAcceptances={JSON.parse(JSON.stringify(task.acceptances))}
      />
    </main>
  );
}

function AcceptancePanel({
  acceptances
}: {
  acceptances: Array<{
    id: string;
    status: string;
    requestedAt: Date;
    respondedAt: Date | null;
    user: { name: string; discordUserId: string | null };
  }>;
}) {
  if (acceptances.length === 0) return null;

  return (
    <div className="mt-5 rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner Acceptance</p>
      <div className="mt-3 grid gap-2">
        {acceptances.map((acceptance) => (
          <div key={acceptance.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
            <div>
              <p className="font-semibold">{acceptance.user.name}</p>
              <p className="text-xs text-slate-500">
                {acceptance.user.discordUserId ? `Discord ID ${acceptance.user.discordUserId}` : "No Discord ID mapped"}
              </p>
            </div>
            <div className="text-right">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${acceptanceStatusClass(acceptance.status)}`}>
                {formatAcceptanceStatus(acceptance.status)}
              </span>
              <p className="mt-1 text-xs text-slate-500">
                {acceptance.respondedAt ? acceptance.respondedAt.toLocaleString() : `Requested ${acceptance.requestedAt.toLocaleString()}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatAcceptanceStatus(status: string) {
  if (status === "NEEDS_CLARIFICATION") return "Needs clarification";
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function acceptanceStatusClass(status: string) {
  if (status === "ACCEPTED") return "bg-emerald-100 text-emerald-700";
  if (status === "NEEDS_CLARIFICATION") return "bg-red-100 text-red-700";
  if (status === "REJECTED") return "bg-slate-200 text-slate-700";
  return "bg-amber-100 text-amber-700";
}

function formatTaskStatus(columnName: string, completedAt: Date | null) {
  if (completedAt || columnName === "Done") return "Completed";
  return columnName;
}

function TaskStatusBadge({ status }: { status: string }) {
  return (
    <div className="inline-flex h-10 w-full items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-3 text-sm font-semibold text-slate-700">
      {status}
    </div>
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
