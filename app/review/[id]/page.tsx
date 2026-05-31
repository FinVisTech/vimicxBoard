import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PendingTaskEditor } from "@/components/PendingTaskEditor";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

export default async function PendingTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pendingTask = await prisma.pendingTask.findUnique({
    where: { id },
    include: { meetingCall: true }
  });

  if (!pendingTask) notFound();
  if (pendingTask.status === "APPROVED" && pendingTask.taskId) redirect(`/tasks/${pendingTask.taskId}`);
  if (pendingTask.status !== "PENDING") redirect("/review");

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <Link href="/review" className="text-sm font-semibold text-primary">
        Back to review queue
      </Link>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-500">Draft tile</p>
          <h1 className="mt-1 text-3xl font-bold">{pendingTask.title}</h1>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          {pendingTask.meetingCall.channelName} - {formatDuration(pendingTask.meetingCall.durationSeconds)} -{" "}
          {formatDistanceToNow(pendingTask.meetingCall.recordedAt, { addSuffix: true })}
        </div>
      </div>

      <PendingTaskEditor task={pendingTask} />

      <section className="mt-5 border-t border-border pt-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Meeting summary</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{pendingTask.meetingCall.summary}</p>
      </section>
    </main>
  );
}
