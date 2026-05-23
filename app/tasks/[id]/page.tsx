import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      assignee: true,
      column: true,
      comments: { include: { user: true }, orderBy: { createdAt: "desc" } },
      activity: { include: { actor: true }, orderBy: { createdAt: "desc" } }
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
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold">{task.priority}</span>
        </div>
        <div className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Owner" value={task.assignee?.name ?? "Unassigned"} />
          <Field label="Due" value={task.dueDate ? task.dueDate.toLocaleDateString() : "No due date"} />
          <Field label="Source" value={task.source} />
          <Field label="Last Updated" value={task.updatedAt.toLocaleString()} />
        </div>
        {task.description ? <p className="mt-6 leading-7 text-slate-700">{task.description}</p> : null}
        {task.isBlocked ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <strong>Blocked:</strong> {task.blockerReason ?? "No reason provided."}
          </div>
        ) : null}
      </section>
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Comments</h2>
          <div className="mt-4 space-y-3">
            {task.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
            {task.comments.map((comment) => (
              <div key={comment.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <p>{comment.body}</p>
                <p className="mt-2 text-xs text-slate-500">{comment.user?.name ?? comment.source}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Activity</h2>
          <div className="mt-4 space-y-3">
            {task.activity.map((item) => (
              <div key={item.id} className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="font-semibold">{item.actionType}</p>
                <p className="mt-1 text-xs text-slate-500">{item.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
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
