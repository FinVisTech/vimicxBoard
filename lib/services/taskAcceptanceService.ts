import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const CUSTOM_ID_PREFIX = "task-owner";

type AcceptanceWithTaskUser = Prisma.TaskAcceptanceGetPayload<{
  include: { task: true; user: true; clarificationComment: true };
}>;

type DiscordMessageView = {
  content: string;
  components: Array<{
    type: 1;
    components: Array<Record<string, unknown>>;
  }>;
};

export type AcceptanceCustomId =
  | { action: "ACCEPT"; taskId: string; userId: string }
  | { action: "CLARIFY"; taskId: string; userId: string }
  | { action: "CLARIFY_MODAL"; taskId: string; userId: string };

export function parseAcceptanceCustomId(customId: string): AcceptanceCustomId | null {
  const [prefix, action, taskId, userId] = customId.split(":");
  if (prefix !== CUSTOM_ID_PREFIX || !action || !taskId || !userId) return null;

  if (action === "accept") return { action: "ACCEPT", taskId, userId };
  if (action === "clarify") return { action: "CLARIFY", taskId, userId };
  if (action === "clarify-modal") return { action: "CLARIFY_MODAL", taskId, userId };
  return null;
}

export function buildClarificationModalCustomId(taskId: string, userId: string) {
  return `${CUSTOM_ID_PREFIX}:clarify-modal:${taskId}:${userId}`;
}

export async function syncTaskAcceptances(taskId: string, assigneeIds: string[]) {
  const nextAssigneeIds = [...new Set(assigneeIds)];
  const existing = await prisma.taskAcceptance.findMany({ where: { taskId } });

  if (nextAssigneeIds.length === 0) {
    await prisma.taskAcceptance.deleteMany({ where: { taskId } });
    return [];
  }

  await prisma.taskAcceptance.deleteMany({
    where: { taskId, userId: { notIn: nextAssigneeIds } }
  });

  const existingUserIds = new Set(existing.map((acceptance) => acceptance.userId));
  const newUserIds = nextAssigneeIds.filter((userId) => !existingUserIds.has(userId));

  if (newUserIds.length === 0) return [];

  await prisma.taskAcceptance.createMany({
    data: newUserIds.map((userId) => ({ taskId, userId })),
    skipDuplicates: true
  });

  const created = await prisma.taskAcceptance.findMany({
    where: { taskId, userId: { in: newUserIds } },
    include: acceptanceInclude
  });

  await Promise.all(created.map((acceptance) => sendAcceptancePrompt(acceptance)));
  return created;
}

export async function sendAcceptancePrompt(acceptance: AcceptanceWithTaskUser) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    await logger.warn("ACCEPTANCE", "Skipped Discord owner prompt because DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID is not configured", {
      taskId: acceptance.taskId,
      userId: acceptance.userId
    });
    return;
  }

  const discordUserId = acceptance.user.discordUserId;
  if (!discordUserId) {
    await logger.warn("ACCEPTANCE", "Skipped Discord owner prompt because assignee has no Discord user ID", {
      taskId: acceptance.taskId,
      userId: acceptance.userId,
      userName: acceptance.user.name
    });
    return;
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...buildPendingAcceptanceView(acceptance),
      allowed_mentions: { users: [discordUserId] }
    })
  });

  if (!response.ok) {
    await logger.error("ACCEPTANCE", `Discord owner prompt failed: ${response.status} ${await response.text()}`, {
      taskId: acceptance.taskId,
      userId: acceptance.userId
    });
    return;
  }

  const message = (await response.json()) as { id?: string; channel_id?: string };
  await prisma.taskAcceptance.update({
    where: { id: acceptance.id },
    data: {
      discordChannelId: message.channel_id ?? channelId,
      discordMessageId: message.id ?? null
    }
  });
}

export async function addTaskClarificationResponse(taskId: string, input: { body: string; userId?: string | null }) {
  const body = input.body.trim();
  if (!body) {
    throw new Error("Clarification body is required");
  }

  const needsClarification = await prisma.taskAcceptance.findMany({
    where: { taskId, status: "NEEDS_CLARIFICATION" },
    include: acceptanceInclude
  });

  if (needsClarification.length === 0) {
    throw new Error("No owner is waiting on clarification for this task");
  }

  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      userId: input.userId ?? null,
      source: "WEB",
      body
    },
    include: { user: true }
  });

  const resetAcceptances = await Promise.all(
    needsClarification.map((acceptance) =>
      prisma.taskAcceptance.update({
        where: { id: acceptance.id },
        data: {
          status: "PENDING",
          requestedAt: new Date(),
          respondedAt: null,
          clarificationCommentId: null
        },
        include: acceptanceInclude
      })
    )
  );

  await Promise.all(resetAcceptances.map((acceptance) => sendClarificationResponsePrompt(acceptance, body)));

  return { comment, acceptances: resetAcceptances };
}

export async function verifyAcceptanceResponder(taskId: string, userId: string, discordUserId: string) {
  const acceptance = await prisma.taskAcceptance.findUnique({
    where: { taskId_userId: { taskId, userId } },
    include: acceptanceInclude
  });

  if (!acceptance) {
    return { ok: false as const, message: "That assignment is no longer active." };
  }

  if (!acceptance.user.discordUserId) {
    return {
      ok: false as const,
      message: `${acceptance.user.name} does not have a Discord user ID mapped in Vimicx Board settings.`
    };
  }

  if (acceptance.user.discordUserId !== discordUserId) {
    return {
      ok: false as const,
      message: `Only ${acceptance.user.name} can respond to this ownership request.`
    };
  }

  return { ok: true as const, acceptance };
}

export async function acceptTaskOwnership(taskId: string, userId: string, discordUserId: string) {
  const verified = await verifyAcceptanceResponder(taskId, userId, discordUserId);
  if (!verified.ok) return verified;

  const alreadyAccepted = verified.acceptance.status === "ACCEPTED";

  if (!alreadyAccepted) {
    await prisma.$transaction([
      prisma.taskAcceptance.update({
        where: { id: verified.acceptance.id },
        data: { status: "ACCEPTED", respondedAt: new Date() }
      }),
      prisma.taskComment.create({
        data: {
          taskId,
          userId,
          source: "DISCORD",
          body: `${verified.acceptance.user.name} accepted ownership.`
        }
      })
    ]);
  }

  const acceptance = await getAcceptanceWithTaskUser(verified.acceptance.id);
  return { ok: true as const, acceptance, view: buildAcceptedAcceptanceView(acceptance), taskUrl: getTaskUrl(taskId) };
}

export async function requestTaskClarification(taskId: string, userId: string, discordUserId: string, body: string) {
  const verified = await verifyAcceptanceResponder(taskId, userId, discordUserId);
  if (!verified.ok) return verified;

  const cleanedBody = body.trim();
  if (!cleanedBody) {
    return { ok: false as const, message: "Add the clarification you need before submitting." };
  }

  const [, comment] = await prisma.$transaction([
    prisma.taskAcceptance.update({
      where: { id: verified.acceptance.id },
      data: { status: "NEEDS_CLARIFICATION", respondedAt: new Date() }
    }),
      prisma.taskComment.create({
        data: {
          taskId,
          userId,
          source: "DISCORD",
          body: `Clarification requested by ${verified.acceptance.user.name}:\n\n${cleanedBody}`
        }
      })
  ]);

  await prisma.taskAcceptance.update({
    where: { id: verified.acceptance.id },
    data: { clarificationCommentId: comment.id }
  });

  const acceptance = await getAcceptanceWithTaskUser(verified.acceptance.id);
  return { ok: true as const, acceptance, view: buildClarificationAcceptanceView(acceptance), taskUrl: getTaskUrl(taskId) };
}

export async function editAcceptancePromptMessage(acceptance: AcceptanceWithTaskUser, view: DiscordMessageView) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token || !acceptance.discordChannelId || !acceptance.discordMessageId) return;

  const response = await fetch(
    `${DISCORD_API_BASE}/channels/${acceptance.discordChannelId}/messages/${acceptance.discordMessageId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...view, allowed_mentions: { parse: [] } })
    }
  );

  if (!response.ok) {
    await logger.warn("ACCEPTANCE", `Could not update owner prompt message: ${response.status} ${await response.text()}`, {
      taskId: acceptance.taskId,
      userId: acceptance.userId,
      discordMessageId: acceptance.discordMessageId
    });
  }
}

export function buildAcceptedAcceptanceView(acceptance: AcceptanceWithTaskUser): DiscordMessageView {
  return {
    content: `Ownership accepted for **${formatDiscordTitle(acceptance.task.title)}** by ${acceptance.user.name}.`,
    components: [actionRow([disabledButton("Accepted", 3, acceptance.taskId, acceptance.userId), openTaskButton(acceptance.taskId)])]
  };
}

export function buildClarificationAcceptanceView(acceptance: AcceptanceWithTaskUser): DiscordMessageView {
  return {
    content: `${acceptance.user.name} asked for clarification on **${formatDiscordTitle(acceptance.task.title)}**. The request was added as a task comment.`,
    components: [actionRow([disabledButton("Needs clarification", 2, acceptance.taskId, acceptance.userId), openTaskButton(acceptance.taskId)])]
  };
}

export function buildClarificationResponseView(acceptance: AcceptanceWithTaskUser, clarification: string): DiscordMessageView {
  const preview = clarification.length > 500 ? `${clarification.slice(0, 497)}...` : clarification;

  return {
    content: `<@${acceptance.user.discordUserId}> clarification was added for **${formatDiscordTitle(acceptance.task.title)}**:\n\n${preview}\n\nCan you accept ownership now?`,
    components: [
      actionRow([
        {
          type: 2,
          style: 3,
          label: "Accept",
          custom_id: `${CUSTOM_ID_PREFIX}:accept:${acceptance.taskId}:${acceptance.userId}`
        },
        {
          type: 2,
          style: 2,
          label: "Needs clarification",
          custom_id: `${CUSTOM_ID_PREFIX}:clarify:${acceptance.taskId}:${acceptance.userId}`
        },
        openTaskButton(acceptance.taskId)
      ])
    ]
  };
}

async function sendClarificationResponsePrompt(acceptance: AcceptanceWithTaskUser, clarification: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;

  if (!token || !channelId) {
    await logger.warn("ACCEPTANCE", "Skipped clarification response prompt because DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID is not configured", {
      taskId: acceptance.taskId,
      userId: acceptance.userId
    });
    return;
  }

  const discordUserId = acceptance.user.discordUserId;
  if (!discordUserId) {
    await logger.warn("ACCEPTANCE", "Skipped clarification response prompt because assignee has no Discord user ID", {
      taskId: acceptance.taskId,
      userId: acceptance.userId,
      userName: acceptance.user.name
    });
    return;
  }

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...buildClarificationResponseView(acceptance, clarification),
      allowed_mentions: { users: [discordUserId] }
    })
  });

  if (!response.ok) {
    await logger.error("ACCEPTANCE", `Discord clarification response prompt failed: ${response.status} ${await response.text()}`, {
      taskId: acceptance.taskId,
      userId: acceptance.userId
    });
    return;
  }

  const message = (await response.json()) as { id?: string; channel_id?: string };
  await prisma.taskAcceptance.update({
    where: { id: acceptance.id },
    data: {
      discordChannelId: message.channel_id ?? channelId,
      discordMessageId: message.id ?? null
    }
  });
}

function buildPendingAcceptanceView(acceptance: AcceptanceWithTaskUser): DiscordMessageView {
  const dueDate = acceptance.task.dueDate
    ? `\nDue: ${acceptance.task.dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "";

  return {
    content: `<@${acceptance.user.discordUserId}> you were assigned:\n\n**${formatDiscordTitle(acceptance.task.title)}**${dueDate}\n\nAccept ownership?`,
    components: [
      actionRow([
        {
          type: 2,
          style: 3,
          label: "Accept",
          custom_id: `${CUSTOM_ID_PREFIX}:accept:${acceptance.taskId}:${acceptance.userId}`
        },
        {
          type: 2,
          style: 2,
          label: "Needs clarification",
          custom_id: `${CUSTOM_ID_PREFIX}:clarify:${acceptance.taskId}:${acceptance.userId}`
        },
        openTaskButton(acceptance.taskId)
      ])
    ]
  };
}

function actionRow(components: Array<Record<string, unknown>>): DiscordMessageView["components"][number] {
  return { type: 1, components };
}

function disabledButton(label: string, style: 2 | 3, taskId: string, userId: string) {
  return {
    type: 2,
    style,
    label,
    custom_id: `${CUSTOM_ID_PREFIX}:done:${taskId}:${userId}`,
    disabled: true
  };
}

function openTaskButton(taskId: string) {
  return { type: 2, style: 5, label: "Open task", url: getTaskUrl(taskId) };
}

function getTaskUrl(taskId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/tasks/${taskId}`;
}

function formatDiscordTitle(title: string) {
  return title.replace(/[*_`~|]/g, "\\$&").slice(0, 180);
}

async function getAcceptanceWithTaskUser(id: string) {
  return prisma.taskAcceptance.findUniqueOrThrow({
    where: { id },
    include: acceptanceInclude
  });
}

const acceptanceInclude = {
  task: true,
  user: true,
  clarificationComment: true
} satisfies Prisma.TaskAcceptanceInclude;
