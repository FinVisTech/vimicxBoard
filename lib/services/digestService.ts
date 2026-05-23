import { addDays, endOfDay, format, startOfDay, subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";

type DigestTask = {
  title: string;
  blockerReason?: string | null;
  assignee?: { name: string } | null;
};

type DigestSections = {
  dueToday: DigestTask[];
  overdue: DigestTask[];
  inProgress: DigestTask[];
  blocked: DigestTask[];
  completedYesterday: DigestTask[];
  unassigned: DigestTask[];
};

export async function buildDailyDigest() {
  const board = await ensureDefaultBoard();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());
  const yesterdayStart = startOfDay(subDays(new Date(), 1));
  const yesterdayEnd = endOfDay(subDays(new Date(), 1));

  const [dueToday, overdue, inProgress, blocked, completedYesterday, unassigned] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: board.id, dueDate: { gte: todayStart, lte: todayEnd }, completedAt: null },
      include: { assignee: true }
    }),
    prisma.task.findMany({
      where: { boardId: board.id, dueDate: { lt: todayStart }, completedAt: null },
      include: { assignee: true }
    }),
    prisma.task.findMany({
      where: { boardId: board.id, column: { name: "In Progress" }, completedAt: null },
      include: { assignee: true }
    }),
    prisma.task.findMany({
      where: { boardId: board.id, OR: [{ isBlocked: true }, { column: { name: "Blocked" } }] },
      include: { assignee: true }
    }),
    prisma.task.findMany({
      where: { boardId: board.id, completedAt: { gte: yesterdayStart, lte: yesterdayEnd } },
      include: { assignee: true }
    }),
    prisma.task.findMany({
      where: { boardId: board.id, assigneeId: null, completedAt: null },
      include: { assignee: true }
    })
  ]);

  return {
    title: "Vimicx Board - Monday/Friday Sync",
    generatedFor: format(addDays(todayStart, 0), "yyyy-MM-dd"),
    sections: {
      dueToday,
      overdue,
      inProgress,
      blocked,
      completedYesterday,
      unassigned
    },
    message: formatDigestMessage({ dueToday, overdue, inProgress, blocked, completedYesterday, unassigned })
  };
}

export function formatDigestMessage(input: DigestSections) {
  return [
    "**Vimicx Board - Monday/Friday Sync**",
    "",
    section("Due Today", input.dueToday),
    section("Overdue", input.overdue),
    section("In Progress", input.inProgress),
    section("Blocked", input.blocked, true),
    section("Completed Yesterday", input.completedYesterday),
    section("Unassigned", input.unassigned)
  ].join("\n");
}

export function isDigestSendDay(date = new Date()) {
  const day = date.getDay();
  return day === 1 || day === 5;
}

export async function sendDigestToDiscord() {
  if (!isDigestSendDay()) {
    return {
      skipped: true,
      reason: "Digest sends only run on Monday and Friday."
    };
  }

  const digest = await buildDailyDigest();
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!channelId || !token) {
    throw new Error("DISCORD_CHANNEL_ID and DISCORD_BOT_TOKEN are required to send digest");
  }

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: digest.message })
  });

  if (!response.ok) {
    throw new Error(`Discord digest post failed: ${response.status} ${await response.text()}`);
  }

  return digest;
}

function section(title: string, tasks: Array<{ title: string; blockerReason?: string | null; assignee?: { name: string } | null }>, includeReason = false) {
  if (tasks.length === 0) {
    return `**${title}:**\n- None`;
  }
  const lines = tasks.map((task) => {
    const owner = task.assignee?.name ? `${task.assignee.name}: ` : "";
    const reason = includeReason && task.blockerReason ? ` - ${task.blockerReason}` : "";
    return `- ${owner}${task.title}${reason}`;
  });
  return `**${title}:**\n${lines.join("\n")}`;
}
