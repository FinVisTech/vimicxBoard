import { type Source } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";
import { createTaskSchema, updateTaskSchema } from "@/lib/validators/tasks";
import type { ParsedBoardCommand } from "@/lib/validators/boardIntent";
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/constants";

export async function createTask(input: unknown) {
  const data = createTaskSchema.parse(input);
  const board = await ensureDefaultBoard();
  const column = await findColumn(data.boardId ?? board.id, data.columnName);
  const createdById = data.createdByDiscordId ? await findOrCreateDiscordUser(data.createdByDiscordId) : null;

  const assigneeIds: string[] = data.assigneeIds
    ?? (data.assigneeId ? [data.assigneeId] : null)
    ?? (data.assigneeName ? await findOrCreateUsersByNames(data.assigneeName) : []);

  const task = await prisma.task.create({
    data: {
      boardId: data.boardId ?? board.id,
      columnId: column.id,
      title: data.title,
      description: data.description,
      createdById,
      priority: data.priority,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      isBlocked: data.isBlocked,
      blockerReason: data.blockerReason,
      source: data.source,
      sourceMessageUrl: data.sourceMessageUrl,
      assignees: assigneeIds.length > 0
        ? { create: assigneeIds.map((userId) => ({ userId })) }
        : undefined
    },
    include: taskInclude
  });

  return task;
}

export async function updateTask(taskId: string, input: unknown) {
  const data = updateTaskSchema.parse(input);
  const before = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude });
  const columnId = data.columnName ? (await findColumn(before.boardId, data.columnName)).id : undefined;
  const completedAt =
    data.columnName === undefined
      ? undefined
      : data.columnName === "Done"
        ? before.completedAt ?? new Date()
        : null;

  // Resolve new assignee IDs when any assignee field is provided
  let assigneesUpdate: { deleteMany: object; create: { userId: string }[] } | undefined;
  if (data.assigneeIds !== undefined) {
    assigneesUpdate = { deleteMany: {}, create: data.assigneeIds.map((userId) => ({ userId })) };
  } else if (data.assigneeId !== undefined) {
    const ids = data.assigneeId ? [data.assigneeId] : [];
    assigneesUpdate = { deleteMany: {}, create: ids.map((userId) => ({ userId })) };
  } else if (data.assigneeName !== undefined) {
    const ids = data.assigneeName ? await findOrCreateUsersByNames(data.assigneeName) : [];
    assigneesUpdate = { deleteMany: {}, create: ids.map((userId) => ({ userId })) };
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: data.title,
      description: data.description,
      assignees: assigneesUpdate,
      columnId,
      priority: data.priority,
      dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      isBlocked: data.isBlocked,
      blockerReason: data.blockerReason,
      completedAt,
      archivedAt: data.isArchived === undefined ? undefined : data.isArchived ? new Date() : null
    },
    include: taskInclude
  });

  return task;
}

export async function addTaskComment(taskId: string, input: { body: string; userId?: string | null; source?: Source }) {
  await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  return prisma.taskComment.create({
    data: {
      taskId,
      body: input.body,
      userId: input.userId ?? null,
      source: input.source ?? "WEB"
    },
    include: { user: true }
  });
}

export async function updateTaskComment(commentId: string, input: { body: string }) {
  return prisma.taskComment.update({
    where: { id: commentId },
    data: { body: input.body },
    include: { user: true }
  });
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
      archivedAt: null,
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

async function findOrCreateUsersByNames(nameInput: string): Promise<string[]> {
  const names = nameInput.split(",").map((n) => n.trim()).filter(Boolean);
  const ids = await Promise.all(
    names.map(async (name) => {
      const user = await prisma.user.upsert({ where: { name }, update: {}, create: { name } });
      return user.id;
    })
  );
  return ids;
}

async function findOrCreateDiscordUser(discordUserId: string) {
  const user = await prisma.user.upsert({
    where: { discordUserId },
    update: {},
    create: { discordUserId, name: `Discord ${discordUserId.slice(-4)}` }
  });
  return user.id;
}

const taskInclude = {
  assignees: { include: { user: true } },
  createdBy: true,
  column: true,
  comments: { include: { user: true }, orderBy: { createdAt: "desc" as const } }
};
