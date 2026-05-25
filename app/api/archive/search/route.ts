import { NextResponse } from "next/server";
import { buildArchiveSearchResults } from "@/lib/archiveSearch";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";

export async function GET(request: Request) {
  const board = await ensureDefaultBoard();
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
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

  return NextResponse.json({ tasks: buildArchiveSearchResults(tasks, query) });
}
