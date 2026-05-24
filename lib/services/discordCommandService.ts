import { parseBoardCommand } from "@/lib/parseBoardCommand";
import { prisma } from "@/lib/prisma";
import { getCommandContext } from "@/lib/services/commandContext";
import { applyParsedCommand } from "@/lib/services/taskService";

export type DiscordCommandInput = {
  rawText: string;
  discordUser: {
    id: string;
    username: string;
    displayName?: string;
  };
};

export async function handleDiscordBoardCommand(input: DiscordCommandInput) {
  const context = await getCommandContext();
  const parsed = await parseBoardCommand({
    rawText: input.rawText,
    discordUser: input.discordUser,
    knownUsers: context.knownUsers,
    knownTasks: context.knownTasks,
    columns: context.columns
  });

  if (parsed.intent === "QUERY_TASKS") {
    return { parsed, message: await answerQuery(parsed) };
  }

  if (parsed.intent === "GENERATE_SUMMARY") {
    return { parsed, message: await answerSummary() };
  }

  const result = await applyParsedCommand(parsed, "DISCORD", input.discordUser.id);
  return { parsed, message: result.message };
}

async function answerQuery(parsed: Awaited<ReturnType<typeof parseBoardCommand>>) {
  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      completedAt: null,
      assignee: parsed.query?.assigneeName ? { name: { equals: parsed.query.assigneeName, mode: "insensitive" } } : undefined,
      column: parsed.query?.status ? { name: { equals: parsed.query.status, mode: "insensitive" } } : undefined,
      OR: parsed.query?.status === "Blocked" ? [{ isBlocked: true }, { column: { name: "Blocked" } }] : undefined
    },
    include: { assignee: true, column: true },
    take: 8,
    orderBy: [{ updatedAt: "desc" }]
  });

  if (tasks.length === 0) {
    return "Nothing matching that right now.";
  }

  return tasks.map((task) => `- ${task.assignee?.name ?? "Unassigned"}: ${task.title} (${task.column.name})`).join("\n");
}

async function answerSummary() {
  const tasks = await prisma.task.findMany({
    where: { archivedAt: null, completedAt: null },
    include: { assignee: true, column: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 10
  });

  const inProgress = tasks.filter((task) => task.column.name === "In Progress").length;
  const blocked = tasks.filter((task) => task.isBlocked || task.column.name === "Blocked").length;
  const unassigned = tasks.filter((task) => !task.assigneeId).length;

  return `Current board: ${inProgress} in progress, ${blocked} blocked, ${unassigned} unassigned.`;
}
