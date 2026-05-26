import { formatDistanceToNow } from "date-fns";
import { prisma } from "@/lib/prisma";
import PendingTaskActions from "@/components/PendingTaskActions";

export const dynamic = "force-dynamic";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700"
};

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function ReviewPage() {
  const meetingCalls = await prisma.meetingCall.findMany({
    where: { pendingTasks: { some: { status: "PENDING" } } },
    include: {
      pendingTasks: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" }
      }
    },
    orderBy: { recordedAt: "desc" }
  });

  const totalPending = meetingCalls.reduce((sum, c) => sum + c.pendingTasks.length, 0);

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Meeting Intelligence</p>
          <h1 className="text-3xl font-bold">
            Review Queue
            {totalPending > 0 && (
              <span className="ml-3 rounded-full bg-primary px-2.5 py-0.5 text-base font-semibold text-white">
                {totalPending}
              </span>
            )}
          </h1>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        {meetingCalls.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-slate-500">
            No action items pending review. The bot polls NotesBot every 5 minutes.
          </div>
        ) : (
          meetingCalls.map((call) => (
            <section key={call.id} className="rounded-lg border border-border bg-white">
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="font-semibold text-slate-800">{call.channelName}</span>
                  <span>{call.serverName}</span>
                  <span>{formatDuration(call.durationSeconds)}</span>
                  <span>{call.participantCount} participant{call.participantCount !== 1 ? "s" : ""}</span>
                  <span>{formatDistanceToNow(call.recordedAt, { addSuffix: true })}</span>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{call.summary}</p>
              </div>

              <div className="divide-y divide-border">
                {call.pendingTasks.map((task) => (
                  <article key={task.id} className="px-5 py-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}
                          >
                            {task.priority}
                          </span>
                          {task.assigneeName && (
                            <span className="text-xs font-medium text-slate-500">→ {task.assigneeName}</span>
                          )}
                        </div>
                        <p className="mt-1 font-semibold text-slate-900">{task.title}</p>
                        {task.description && (
                          <p className="mt-1 text-sm leading-5 text-slate-600">{task.description}</p>
                        )}
                        {task.contextNotes && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-slate-600">
                              Meeting context
                            </summary>
                            <p className="mt-1.5 whitespace-pre-wrap rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 border border-slate-100">
                              {task.contextNotes}
                            </p>
                          </details>
                        )}
                      </div>
                      <PendingTaskActions taskId={task.id} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
