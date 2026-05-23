import { getBoardSnapshot } from "@/lib/services/bootstrap";
import { prisma } from "@/lib/prisma";

export async function getCommandContext() {
  const board = await getBoardSnapshot();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return {
    board,
    knownUsers: users.map((user) => ({
      id: user.id,
      name: user.name,
      discordUserId: user.discordUserId
    })),
    knownTasks: board.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      columnName: task.column.name,
      assigneeName: task.assignee?.name ?? null
    })),
    columns: board.columns.map((column) => column.name)
  };
}
