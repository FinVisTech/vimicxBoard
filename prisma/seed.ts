import { PrismaClient } from "@prisma/client";
import { DEFAULT_COLUMNS } from "../lib/constants";

const prisma = new PrismaClient();

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { id: "default-workspace" },
    update: {
      discordGuildId: process.env.DISCORD_GUILD_ID || null,
      discordChannelId: process.env.DISCORD_CHANNEL_ID || null
    },
    create: {
      id: "default-workspace",
      name: "Vimicx",
      discordGuildId: process.env.DISCORD_GUILD_ID || null,
      discordChannelId: process.env.DISCORD_CHANNEL_ID || null
    }
  });

  const board = await prisma.board.upsert({
    where: { id: "default-board" },
    update: {},
    create: { id: "default-board", name: "Vimicx Board", workspaceId: workspace.id }
  });

  const columns = await Promise.all(
    DEFAULT_COLUMNS.map((name, position) =>
      prisma.boardColumn.upsert({
        where: { boardId_name: { boardId: board.id, name } },
        update: { position },
        create: { boardId: board.id, name, position }
      })
    )
  );

  const luke = await prisma.user.upsert({
    where: { name: "Luke" },
    update: {},
    create: { name: "Luke", role: "ADMIN" }
  });
  const dalton = await prisma.user.upsert({
    where: { name: "Dalton" },
    update: {},
    create: { name: "Dalton" }
  });

  const todo = columns.find((column) => column.name === "To Do")!;
  const progress = columns.find((column) => column.name === "In Progress")!;
  const backlog = columns.find((column) => column.name === "Backlog")!;

  const tasks = [
    { title: "Test turret yaw calibration", assigneeId: dalton.id, columnId: todo.id, priority: "HIGH" as const },
    { title: "Build dealer demo script", assigneeId: luke.id, columnId: progress.id, priority: "HIGH" as const },
    { title: "Validate Jetson inference setup", assigneeId: dalton.id, columnId: progress.id, priority: "MEDIUM" as const },
    { title: "Create Pacific Coast pilot user list", assigneeId: luke.id, columnId: backlog.id, priority: "MEDIUM" as const },
    { title: "Update BOM model", assigneeId: null, columnId: todo.id, priority: "LOW" as const }
  ];

  for (const task of tasks) {
    const existing = await prisma.task.findFirst({ where: { boardId: board.id, title: task.title } });
    if (!existing) {
      await prisma.task.create({
        data: {
          ...task,
          boardId: board.id,
          source: "WEB",
          createdById: luke.id
        }
      });
    }
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
