import { ArchiveSearchClient } from "@/components/ArchiveSearchClient";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";

export const dynamic = "force-dynamic";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const board = await ensureDefaultBoard();
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const tasks = await prisma.task.findMany({
    where: {
      boardId: board.id,
      archivedAt: { not: null }
    },
    include: {
      assignee: true,
      column: true,
      comments: { orderBy: { createdAt: "desc" } }
    },
    orderBy: [{ archivedAt: "desc" }, { updatedAt: "desc" }]
  });
  const archiveItems = JSON.parse(JSON.stringify(tasks));

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <ArchiveSearchClient initialQuery={query} archiveItems={archiveItems} />
    </main>
  );
}
