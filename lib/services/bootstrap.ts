import { DEFAULT_BOARD_NAME, DEFAULT_COLUMNS, DEFAULT_WORKSPACE_NAME } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function ensureDefaultBoard() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "default-workspace" },
    update: {},
    create: {
      id: "default-workspace",
      name: DEFAULT_WORKSPACE_NAME,
      discordGuildId: process.env.DISCORD_GUILD_ID || null,
      discordChannelId: process.env.DISCORD_CHANNEL_ID || null
    }
  });

  const board = await prisma.board.upsert({
    where: { id: "default-board" },
    update: {},
    create: {
      id: "default-board",
      name: DEFAULT_BOARD_NAME,
      workspaceId: workspace.id
    }
  });

  await Promise.all(
    DEFAULT_COLUMNS.map((name, position) =>
      prisma.boardColumn.upsert({
        where: { boardId_name: { boardId: board.id, name } },
        update: { position },
        create: { boardId: board.id, name, position }
      })
    )
  );

  return prisma.board.findUniqueOrThrow({
    where: { id: board.id },
    include: { workspace: true, columns: { orderBy: { position: "asc" } } }
  });
}

export async function getBoardSnapshot(boardId = "default-board") {
  await ensureDefaultBoard();
  return prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      workspace: true,
      columns: { orderBy: { position: "asc" }, include: { tasks: true } },
      tasks: {
        include: { assignee: true, column: true },
        orderBy: [{ updatedAt: "desc" }]
      }
    }
  });
}
