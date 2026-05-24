import { formatDistanceToNow } from "date-fns";
import { ArchiveRestoreButton } from "@/components/ArchiveRestoreButton";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const board = await ensureDefaultBoard();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const tasks = await prisma.task.findMany({
    where: {
      boardId: board.id,
      archivedAt: { not: null },
      OR: query
        ? [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
            { comments: { some: { body: { contains: query, mode: "insensitive" } } } },
            { assignee: { name: { contains: query, mode: "insensitive" } } }
          ]
        : undefined
    },
    include: {
      assignee: true,
      column: true,
      comments: { orderBy: { createdAt: "desc" }, take: 2 }
    },
    orderBy: [{ archivedAt: "desc" }, { updatedAt: "desc" }]
  });

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Archive</p>
          <h1 className="text-3xl font-bold">Archived Tiles</h1>
        </div>
        <form action="/archive" className="flex w-full gap-2 sm:w-auto">
          <Input name="q" defaultValue={query} placeholder="Search archived tiles" className="min-w-0 flex-1 sm:w-80" />
          <button className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-white" type="submit">
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 grid gap-3">
        {tasks.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-6 text-sm text-slate-600">No archived tiles found.</div>
        ) : (
          tasks.map((task) => (
            <article key={task.id} className="rounded-lg border border-border bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                    <span>{task.column.name}</span>
                    <span>{task.assignee?.name ?? "Unassigned"}</span>
                    <span>{task.archivedAt ? `Archived ${formatDistanceToNow(task.archivedAt, { addSuffix: true })}` : "Archived"}</span>
                  </div>
                  <Link href={`/tasks/${task.id}`} className="mt-1 block text-lg font-semibold text-slate-950">
                    {task.title}
                  </Link>
                  {task.description ? <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">{task.description}</p> : null}
                  {task.comments[0] ? <p className="mt-2 text-sm text-slate-500">Latest note: {task.comments[0].body}</p> : null}
                </div>
                <ArchiveRestoreButton taskId={task.id} />
              </div>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
