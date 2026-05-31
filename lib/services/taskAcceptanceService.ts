import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const DISCORD_API_BASE = "https://discord.com/api/v10";
const CUSTOM_ID_PREFIX = "task-owner";
const MAX_INTERACTIVE_OWNERS = 4;

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

  await sendTaskAcceptancePrompt(taskId, newUserIds);
  return created;
}

export async function sendAcceptancePrompt(acceptance: AcceptanceWithTaskUser) {
  await sendTaskAcceptancePrompt(acceptance.taskId, [acceptance.userId]);
}

export async function sendTaskAcceptancePrompt(taskId: string, mentionUserIds?: string[], clarification?: string) {
  const token = process.env.DISCORD_BOT_TOKEN;
  const channelId = process.env.DISCORD_CHANNEL_ID;
  const acceptances = await getTaskAcceptances(taskId);

  if (!token || !channelId) {
    await logger.warn("ACCEPTANCE", "Skipped Discord owner prompt because DISCORD_BOT_TOKEN or DISCORD_CHANNEL_ID is not configured", {
      taskId
    });
    return;
  }

  const mentionSet = new Set(mentionUserIds ?? acceptances.map((acceptance) => acceptance.userId));
  const mentionDiscordIds = getMentionDiscordIds(acceptances, mentionSet);

  await logUnmappedMentions(acceptances, mentionSet);

  const response = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ...buildTaskAcceptancePanelView(acceptances, { mentionUserIds: mentionSet, clarification }),
      allowed_mentions: { users: mentionDiscordIds }
    })
  });

  if (!response.ok) {
    await logger.error("ACCEPTANCE", `Discord owner prompt failed: ${response.status} ${await response.text()}`, {
      taskId
    });
    return;
  }

  const message = (await response.json()) as { id?: string; channel_id?: string };
  await prisma.taskAcceptance.updateMany({
    where: { taskId },
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

  await Promise.all(
    needsClarification.map((acceptance) =>
      prisma.taskAcceptance.update({
        where: { id: acceptance.id },
        data: {
          status: "PENDING",
          requestedAt: new Date(),
          respondedAt: null,
          clarificationCommentId: null
        }
      })
    )
  );

  const resetUserIds = needsClarification.map((acceptance) => acceptance.userId);
  await sendTaskAcceptancePrompt(taskId, resetUserIds, body);

  const acceptances = await getTaskAcceptances(taskId);
  return { comment, acceptances };
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

  const acceptances = await getTaskAcceptances(taskId);
  return {
    ok: true as const,
    acceptance: verified.acceptance,
    view: buildTaskAcceptancePanelView(acceptances),
    taskUrl: getTaskUrl(taskId)
  };
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

  const acceptances = await getTaskAcceptances(taskId);
  return {
    ok: true as const,
    acceptance: verified.acceptance,
    view: buildTaskAcceptancePanelView(acceptances),
    taskUrl: getTaskUrl(taskId)
  };
}

export async function editAcceptancePromptMessage(acceptance: AcceptanceWithTaskUser, view?: DiscordMessageView) {
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
      body: JSON.stringify({
        ...(view ?? buildTaskAcceptancePanelView(await getTaskAcceptances(acceptance.taskId))),
        allowed_mentions: { parse: [] }
      })
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
  return buildTaskAcceptancePanelView([{ ...acceptance, status: "ACCEPTED" }]);
}

export function buildClarificationAcceptanceView(acceptance: AcceptanceWithTaskUser): DiscordMessageView {
  return buildTaskAcceptancePanelView([{ ...acceptance, status: "NEEDS_CLARIFICATION" }]);
}

export function buildClarificationResponseView(
  acceptances: AcceptanceWithTaskUser[],
  clarification: string,
  mentionUserIds = new Set(acceptances.map((acceptance) => acceptance.userId))
): DiscordMessageView {
  return buildTaskAcceptancePanelView(acceptances, { mentionUserIds, clarification });
}

export function buildTaskAcceptancePanelView(
  acceptances: AcceptanceWithTaskUser[],
  options?: { mentionUserIds?: Set<string>; clarification?: string }
): DiscordMessageView {
  const first = acceptances[0];
  const taskTitle = first ? formatDiscordTitle(first.task.title) : "Task";
  const mentions = acceptances
    .filter((acceptance) => options?.mentionUserIds?.has(acceptance.userId))
    .map((acceptance) => acceptance.user.discordUserId)
    .filter((discordUserId): discordUserId is string => Boolean(discordUserId))
    .map((discordUserId) => `<@${discordUserId}>`);
  const mentionLine = mentions.length > 0 ? `${mentions.join(" ")} you were assigned:` : "Owner acceptance:";
  const clarification = options?.clarification
    ? `\n\nClarification added:\n${truncateForDiscord(options.clarification, 500)}`
    : "";

  const rows = first ? [actionRow([openTaskButton(first.taskId)])] : [];
  rows.push(...acceptances.slice(0, MAX_INTERACTIVE_OWNERS).map((acceptance) => actionRow(ownerActionButtons(acceptance))));

  return {
    content: `${mentionLine}\n\n**${taskTitle}**${clarification}`,
    components: rows
  };
}

function actionRow(components: Array<Record<string, unknown>>): DiscordMessageView["components"][number] {
  return { type: 1, components };
}

function openTaskButton(taskId: string) {
  return { type: 2, style: 5, label: "Open task", url: getTaskUrl(taskId) };
}

function ownerActionButtons(acceptance: AcceptanceWithTaskUser) {
  const isPending = acceptance.status === "PENDING";
  const isAccepted = acceptance.status === "ACCEPTED";
  const needsClarification = acceptance.status === "NEEDS_CLARIFICATION";

  return [
    disabledButton(`${acceptance.user.name}:`, 2, `label`, acceptance.taskId, acceptance.userId),
    {
      type: 2,
      style: isAccepted ? 3 : 2,
      label: "Accept",
      custom_id: `${CUSTOM_ID_PREFIX}:accept:${acceptance.taskId}:${acceptance.userId}`,
      disabled: !isPending
    },
    {
      type: 2,
      style: needsClarification ? 4 : 2,
      label: "I need clarification",
      custom_id: `${CUSTOM_ID_PREFIX}:clarify:${acceptance.taskId}:${acceptance.userId}`,
      disabled: !isPending
    },
    disabledButton(formatAcceptanceStatus(acceptance.status), acceptanceStatusStyle(acceptance.status), "status", acceptance.taskId, acceptance.userId)
  ];
}

function disabledButton(label: string, style: 2 | 3 | 4, purpose: string, taskId: string, userId: string) {
  return {
    type: 2,
    style,
    label: label.slice(0, 80),
    custom_id: `${CUSTOM_ID_PREFIX}:${purpose}:${taskId}:${userId}`,
    disabled: true
  };
}

function getTaskUrl(taskId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${baseUrl.replace(/\/$/, "")}/tasks/${taskId}`;
}

function formatDiscordTitle(title: string) {
  return title.replace(/[*_`~|]/g, "\\$&").slice(0, 180);
}

function formatAcceptanceStatus(status: string) {
  if (status === "ACCEPTED") return "Accepted";
  if (status === "NEEDS_CLARIFICATION") return "Needs clarification";
  if (status === "REJECTED") return "Not accepted";
  return "Pending";
}

function acceptanceStatusStyle(status: string): 2 | 3 | 4 {
  if (status === "ACCEPTED") return 3;
  if (status === "NEEDS_CLARIFICATION" || status === "REJECTED") return 4;
  return 2;
}

function truncateForDiscord(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function getMentionDiscordIds(acceptances: AcceptanceWithTaskUser[], mentionUserIds: Set<string>) {
  return acceptances
    .filter((acceptance) => mentionUserIds.has(acceptance.userId))
    .map((acceptance) => acceptance.user.discordUserId)
    .filter((discordUserId): discordUserId is string => Boolean(discordUserId));
}

async function logUnmappedMentions(acceptances: AcceptanceWithTaskUser[], mentionUserIds: Set<string>) {
  const unmapped = acceptances.filter((acceptance) => mentionUserIds.has(acceptance.userId) && !acceptance.user.discordUserId);
  await Promise.all(
    unmapped.map((acceptance) =>
      logger.warn("ACCEPTANCE", "Skipped mentioning assignee because they have no Discord user ID", {
        taskId: acceptance.taskId,
        userId: acceptance.userId,
        userName: acceptance.user.name
      })
    )
  );
}

async function getTaskAcceptances(taskId: string) {
  return prisma.taskAcceptance.findMany({
    where: { taskId },
    include: acceptanceInclude,
    orderBy: { requestedAt: "asc" }
  });
}

const acceptanceInclude = {
  task: true,
  user: true,
  clarificationComment: true
} satisfies Prisma.TaskAcceptanceInclude;
