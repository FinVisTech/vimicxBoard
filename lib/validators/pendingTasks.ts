import { z } from "zod";
import { priorityEnum } from "./boardIntent";

export const updatePendingTaskSchema = z.object({
  title: z.string().trim().min(2).optional(),
  description: z.string().trim().nullable().optional(),
  contextNotes: z.string().trim().nullable().optional(),
  assigneeName: z.string().trim().nullable().optional(),
  assigneeIds: z.array(z.string().min(1)).optional(),
  priority: priorityEnum.optional()
});
