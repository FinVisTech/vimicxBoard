import { Prisma, type Source } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators/tasks";
import type { ParsedBoardCommand } from "@/lib/validators/boardIntent";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/constants";

export async function createTask(input: unknown) {
  const data = createTaskSchema.parse(input);
  const board = await ensureDefaultBoard();
  const column = await findColumn(data.boardId ?? board.id, data.columnName);
  const assigneeId = data.assigneeId ?? (data.assigneeName ? await findOrCreateUserByName(data.assigneeName) : null);
  const createdById = data.createdByDiscordId ? await findOrCreateDiscordUser(data.createdByDiscordId) : null;

  const task = await prisma.task.create({
    data: {
      boardId: data.boardId ?? board.id,
      columnId: column.id,
      title: data.title,
      description: data.description,
      assigneeId,
      createdById,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isBlocked: data.isBlocked,
      blockerReason: data.blockerReason,
      source: data.source,
      sourceMessageUrl: data.sourceMessageUrl
    },
    include: taskInclude
  });

  await logActivity(task.boardId, task.id, createdById, "TASK_CREATED", null, task);
  return task;
}

export async function updateTask(taskId: string, input: unknown) {
  const data = updateTaskSchema.parse(input);
  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
  const assigneeId =
    data.assigneeId !== undefined
      ? data.assigneeId
      : data.assigneeName !== undefined
        ? data.assigneeName
          ? await findOrCreateUserByName(data.assigneeName)
          : null
        : undefined;
  const columnId = data.columnName ? (await findColumn(before.boardId, data.columnName)).id : undefined;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: data.title,
      description: data.description,
      assigneeId,
      columnId,
      priority: data.priority,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      isBlocked: data.isBlocked,
      blockerReason: data.blockerReason,
      completedAt: data.columnName === "Done" ? new Date() : data.columnName ? null : undefined
    },
    include: taskInclude
  });

  await logActivity(task.boardId, task.id, null, "TASK_UPDATED", before, task);
  return task;
}

export async function addTaskComment(taskId: string, input: { body: string; userId?: string | null; source?: Source }) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  const comment = await prisma.taskComment.create({
    data: {
      taskId,
      body: input.body,
      userId: input.userId ?? null,
      source: input.source ?? "WEB"
    },
    include: { user: true }
  });
  await logActivity(task.boardId, task.id, input.userId ?? null, "COMMENT_ADDED", null, comment);
  return comment;
}

export async function applyParsedCommand(command: ParsedBoardCommand, source: Source, discordUserId?: string) {
  if (command.confidence < LOW_CONFIDENCE_THRESHOLD || command.intent === "UNKNOWN") {
    return { type: "clarification" as const, message: command.responseMessage };
  }

  if (command.intent === "CREATE_TASK" && command.task?.title) {
    const task = await createTask({
      title: command.task.title,
      description: command.task.description,
      assigneeName: command.task.assigneeName,
      priority: command.task.priority ?? "MEDIUM",
      dueDate: command.task.dueDateISO,
      columnName: command.task.columnName ?? "To Do",
      isBlocked: command.task.isBlocked ?? false,
      blockerReason: command.task.blockerReason,
      source,
      createdByDiscordId: discordUserId ?? null
    });
    return { type: "mutation" as const, task, message: command.responseMessage };
  }

  const target = command.targetTask?.titleOrId ? await findTaskByTitleOrId(command.targetTask.titleOrId) : null;
  if (["MOVE_TASK", "ASSIGN_TASK", "UPDATE_TASK"].includes(command.intent) && !target) {
    return { type: "clarification" as const, message: "I could not find that task. Which card did you mean?" };
  }

  if (command.intent === "MOVE_TASK" && target && command.task?.columnName) {
    const task = await updateTask(target.id, { columnName: command.task.columnName, source });
    return { type: "mutation" as const, task, message: command.responseMessage };
  }

  if (command.intent === "ASSIGN_TASK" && target && command.task?.assigneeName) {
    const task = await updateTask(target.id, { assigneeName: command.task.assigneeName, source });
    return { type: "mutation" as const, task, message: command.responseMessage };
  }

  if (command.intent === "COMMENT_TASK" && target && command.task?.description) {
    const comment = await addTaskComment(target.id, { body: command.task.description, source });
    return { type: "mutation" as const, comment, message: command.responseMessage };
  }

  return { type: "query" as const, message: command.responseMessage };
}

export async function findTaskByTitleOrId(titleOrId: string) {
  return prisma.task.findFirst({
    where: {
      OR: [
        { id: titleOrId },
        { title: { equals: titleOrId, mode: "insensitive" } },
        { title: { contains: titleOrId, mode: "insensitive" } }
      ]
    },
    include: taskInclude
  });
}

async function findColumn(boardId: string, name: string) {
  return prisma.boardColumn.findFirstOrThrow({
    where: { boardId, name: { equals: name, mode: "insensitive" } }
  });
}

async function findOrCreateUserByName(name: string) {
  const user = await prisma.user.upsert({
    where: { name },
    update: {},
    create: { name }
  });
  return user.id;
}

async function findOrCreateDiscordUser(discordUserId: string) {
  const user = await prisma.user.upsert({
    where: { discordUserId },
    update: {},
    create: { discordUserId, name: `Discord ${discordUserId.slice(-4)}` }
  });
  return user.id;
}

async function logActivity(boardId: string, taskId: string | null, actorId: string | null, actionType: string, before: unknown, after: unknown) {
  await prisma.activityLog.create({
    data: {
      boardId,
      taskId,
      actorId,
      actionType,
      beforeJson: toJson(before),
      afterJson: toJson(after)
    }
  });
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

const taskInclude = {
  assignee: true,
  createdBy: true,
  column: true,
  comments: { include: { user: true }, orderBy: { createdAt: "desc" as const } },
  activity: { include: { actor: true }, orderBy: { createdAt: "desc" as const } }
};
