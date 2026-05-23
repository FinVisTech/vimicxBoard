import { z } from "zod";

export const intentEnum = z.enum([
  "CREATE_TASK",
  "UPDATE_TASK",
  "MOVE_TASK",
  "ASSIGN_TASK",
  "COMMENT_TASK",
  "QUERY_TASKS",
  "GENERATE_SUMMARY",
  "UNKNOWN"
]);

export const priorityEnum = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const sourceEnum = z.enum(["WEB", "DISCORD", "SLACK", "AGENT"]);

export const parsedBoardCommandSchema = z.object({
  intent: intentEnum,
  confidence: z.number().min(0).max(1),
  task: z
    .object({
      title: z.string().nullable(),
      description: z.string().nullable(),
      assigneeName: z.string().nullable(),
      priority: priorityEnum.nullable(),
      dueDateNaturalLanguage: z.string().nullable(),
      dueDateISO: z.string().datetime({ offset: true }).nullable(),
      columnName: z.string().nullable(),
      isBlocked: z.boolean().nullable(),
      blockerReason: z.string().nullable()
    })
    .nullable(),
  targetTask: z
    .object({
      titleOrId: z.string().nullable()
    })
    .nullable(),
  query: z
    .object({
      assigneeName: z.string().nullable(),
      status: z.string().nullable(),
      timeframe: z.string().nullable()
    })
    .nullable(),
  responseMessage: z.string()
});

export type ParsedBoardCommand = z.infer<typeof parsedBoardCommandSchema>;

export const parseCommandRequestSchema = z.object({
  rawText: z.string().min(1),
  discordUser: z
    .object({
      id: z.string(),
      username: z.string(),
      displayName: z.string().optional()
    })
    .optional()
});

export const agentActionSchema = z.object({
  agentName: z.string().min(1),
  action: z.enum(["CREATE_TASK", "UPDATE_TASK", "MOVE_TASK", "COMMENT_TASK", "GENERATE_SUMMARY"]),
  payload: z.record(z.unknown()).default({}),
  reasoningSummary: z.string().min(1)
});
