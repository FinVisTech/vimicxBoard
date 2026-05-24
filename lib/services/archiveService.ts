import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";

export function getDoneArchiveCutoff(days: number, now = new Date()) {
  return subDays(now, days);
}

export function shouldAutoArchiveDoneTask(input: { completedAt: Date | null; archivedAt: Date | null; archiveDoneAfterDays: number; now?: Date }) {
  if (!input.completedAt || input.archivedAt) return false;
  return input.completedAt <= getDoneArchiveCutoff(input.archiveDoneAfterDays, input.now);
}

export async function archiveEligibleDoneTasks(boardId = "default-board") {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: { workspace: true }
  });
  if (!board) return { count: 0 };

  const cutoff = getDoneArchiveCutoff(board.workspace.archiveDoneAfterDays);
  return prisma.task.updateMany({
    where: {
      boardId,
      archivedAt: null,
      completedAt: { lte: cutoff },
      column: { name: "Done" }
    },
    data: { archivedAt: new Date() }
  });
}
