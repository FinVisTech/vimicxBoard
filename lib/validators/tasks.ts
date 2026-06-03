import { z } from "zod";
import { priorityEnum, sourceEnum } from "./boardIntent";

export const createTaskSchema = z.object({
  boardId: z.string().optional(),
  title: z.string().trim().min(2),
  description: z.string().trim().nullable().optional(),
  assigneeName: z.string().trim().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  dmUserIds: z.array(z.string()).optional(),
  columnName: z.string().default("To Do"),
  priority: priorityEnum.default("MEDIUM"),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  isBlocked: z.boolean().default(false),
  blockerReason: z.string().trim().nullable().optional(),
  source: sourceEnum.default("WEB"),
  sourceMessageUrl: z.string().url().nullable().optional(),
  createdByDiscordId: z.string().nullable().optional()
});

export const updateTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  assigneeIds: z.array(z.string()).optional(),
  assigneeName: z.string().trim().nullable().optional(),
  columnName: z.string().optional(),
  priority: priorityEnum.optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  isBlocked: z.boolean().optional(),
  blockerReason: z.string().trim().nullable().optional(),
  isArchived: z.boolean().optional(),
  source: sourceEnum.default("WEB")
});

export const updateWorkspaceSettingsSchema = z.object({
  archiveDoneAfterDays: z.coerce.number().int().min(0).max(365)
});

export const createCommentSchema = z.object({
  body: z.string().trim().min(1),
  userId: z.string().nullable().optional(),
  source: sourceEnum.default("WEB")
});

export const updateCommentSchema = z.object({
  body: z.string().trim().min(1)
});
