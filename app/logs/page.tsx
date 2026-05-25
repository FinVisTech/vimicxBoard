import { formatDistanceToNow, format } from "date-fns";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-slate-100 text-slate-500"
};

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${color}`}>{label}</span>;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function LogsPage() {
  const [pollLogs, meetingCalls, pendingTasks] = await Promise.all([
    prisma.pollLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.meetingCall.findMany({
      orderBy: { recordedAt: "desc" },
      take: 20,
      include: { _count: { select: { pendingTasks: true } } }
    }),
    prisma.pendingTask.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { meetingCall: { select: { channelName: true, recordedAt: true } } }
    })
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 space-y-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">Debug</p>
        <h1 className="text-3xl font-bold">Logs</h1>
        <p className="mt-1 text-sm text-slate-500">Refresh the page to see the latest data. All times are UTC.</p>
      </div>

      {/* Section 1: Poll History */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Poll History</h2>
        <p className="mb-3 text-xs text-slate-500">Did the bot fire? Did it reach the NotesBot API?</p>
        {pollLogs.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-slate-500">
            No poll logs yet. The bot logs a row every 5 minutes after it fires.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Time</th>
                  <th className="px-4 py-2 text-right">Calls Found</th>
                  <th className="px-4 py-2 text-right">New</th>
                  <th className="px-4 py-2 text-right">Tasks Extracted</th>
                  <th className="px-4 py-2 text-left">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pollLogs.map((log) => (
                  <tr key={log.id} className={log.errorMessage ? "bg-red-50" : ""}>
                    <td className="px-4 py-2 text-slate-600 whitespace-nowrap">
                      {format(log.createdAt, "MMM d, HH:mm:ss")}
                      <span className="ml-2 text-xs text-slate-400">
                        ({formatDistanceToNow(log.createdAt, { addSuffix: true })})
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{log.callsFound}</td>
                    <td className="px-4 py-2 text-right font-mono">{log.callsNew}</td>
                    <td className="px-4 py-2 text-right font-mono">{log.tasksExtracted}</td>
                    <td className="px-4 py-2 text-xs text-red-600">
                      {log.errorMessage ?? <span className="text-green-600">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Meeting Pipeline */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Meeting Pipeline</h2>
        <p className="mb-3 text-xs text-slate-500">Did transcripts arrive? Did the LLM extract tasks?</p>
        {meetingCalls.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-slate-500">
            No meetings processed yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {meetingCalls.map((call) => (
              <article key={call.id} className="rounded-lg border border-border bg-white p-4">
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
                  <span className="font-semibold text-slate-800">{call.channelName}</span>
                  <span>{call.serverName}</span>
                  <span>{formatDuration(call.durationSeconds)}</span>
                  <span>{call.participantCount} participant{call.participantCount !== 1 ? "s" : ""}</span>
                  <span>{format(call.recordedAt, "MMM d, HH:mm")}</span>
                  <Badge
                    label={`${call._count.pendingTasks} task${call._count.pendingTasks !== 1 ? "s" : ""} extracted`}
                    color={call._count.pendingTasks > 0 ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}
                  />
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Transcript snippet</p>
                  <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs leading-5 text-slate-700 whitespace-pre-wrap break-words">
                    {call.transcript.slice(0, 400)}{call.transcript.length > 400 ? "\n…" : ""}
                  </pre>
                </div>
                <div className="mt-2">
                  <p className="mb-1 text-xs font-semibold uppercase text-slate-400">Summary</p>
                  <p className="text-sm text-slate-600 line-clamp-3">{call.summary}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Task Disposition */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-800">Task Disposition</h2>
        <p className="mb-3 text-xs text-slate-500">Did extracted tasks land in the right place?</p>
        {pendingTasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-5 text-sm text-slate-500">
            No tasks extracted yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-white">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2 text-left">Title</th>
                  <th className="px-4 py-2 text-left">Assignee</th>
                  <th className="px-4 py-2 text-left">Priority</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-left">Meeting</th>
                  <th className="px-4 py-2 text-left">Extracted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingTasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-4 py-2 font-medium text-slate-800 max-w-xs truncate">{task.title}</td>
                    <td className="px-4 py-2 text-slate-500">{task.assigneeName ?? "—"}</td>
                    <td className="px-4 py-2">{task.priority}</td>
                    <td className="px-4 py-2">
                      <Badge label={task.status} color={STATUS_COLORS[task.status]} />
                    </td>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{task.meetingCall.channelName}</td>
                    <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">
                      {formatDistanceToNow(task.createdAt, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
