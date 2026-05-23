import { addDays, formatISO, isBefore, nextFriday, setHours, setMinutes } from "date-fns";
import { getLlmClient, type LlmClient } from "@/lib/llm/client";
import { parsedBoardCommandSchema, type ParsedBoardCommand } from "@/lib/validators/boardIntent";

type CommandContext = {
  rawText: string;
  discordUser?: { id: string; username: string; displayName?: string };
  knownUsers: Array<{ id: string; name: string; discordUserId?: string | null }>;
  knownTasks: Array<{ id: string; title: string; columnName: string; assigneeName?: string | null }>;
  columns: string[];
  now?: Date;
  llmClient?: LlmClient;
};

const emptyTask = {
  title: null,
  description: null,
  assigneeName: null,
  priority: null,
  dueDateNaturalLanguage: null,
  dueDateISO: null,
  columnName: null,
  isBlocked: null,
  blockerReason: null
};

export async function parseBoardCommand(context: CommandContext): Promise<ParsedBoardCommand> {
  const heuristic = parseWithHeuristics(context);
  if (heuristic.confidence >= 0.9 || !process.env.OPENAI_API_KEY) {
    return heuristic;
  }

  try {
    const client = context.llmClient ?? getLlmClient();
    const result = await client.completeJson([
      {
        role: "system",
        content:
          "You convert Vimicx Board Discord messages into one strict JSON intent. Do not mutate state. If ambiguous, lower confidence and ask a short clarification in responseMessage."
      },
      {
        role: "user",
        content: JSON.stringify({
          todayISO: formatISO(context.now ?? new Date()),
          rawText: context.rawText,
          discordUser: context.discordUser,
          knownUsers: context.knownUsers,
          knownTasks: context.knownTasks,
          columns: context.columns,
          requiredShape:
            "Return {intent, confidence, task, targetTask, query, responseMessage}. Use null for unused nested objects. dueDateISO must be ISO datetime or null."
        })
      }
    ]);

    return parsedBoardCommandSchema.parse(result);
  } catch {
    return heuristic;
  }
}

export function parseWithHeuristics(context: CommandContext): ParsedBoardCommand {
  const raw = context.rawText.replace(/<@!?\d+>|@board/gi, "").trim();
  const text = raw.replace(/[“”]/g, "\"");
  const lower = text.toLowerCase();
  const now = context.now ?? new Date();

  if (/\b(summarize|summary|daily sync)\b/.test(lower)) {
    return base("GENERATE_SUMMARY", 0.92, "Here is the current board summary.");
  }

  if (/\b(blockers|blocked)\b/.test(lower) && !/\bmark|set|is blocked|blocked by|because\b/.test(lower)) {
    return {
      ...base("QUERY_TASKS", 0.92, "Showing current blockers."),
      query: { assigneeName: null, status: "Blocked", timeframe: null }
    };
  }

  const workingMatch = lower.match(/what is ([a-z]+) working on/);
  if (workingMatch) {
    return {
      ...base("QUERY_TASKS", 0.94, `Showing what ${capitalize(workingMatch[1])} is working on.`),
      query: { assigneeName: capitalize(workingMatch[1]), status: null, timeframe: null }
    };
  }

  const moveMatch = text.match(/\bmove\s+"?([^"]+?)"?\s+to\s+(.+)$/i);
  if (moveMatch) {
    const columnName = matchColumn(moveMatch[2], context.columns);
    return {
      intent: "MOVE_TASK",
      confidence: columnName ? 0.94 : 0.62,
      task: { ...emptyTask, columnName },
      targetTask: { titleOrId: moveMatch[1].trim() },
      query: null,
      responseMessage: columnName
        ? `Moved: ${moveMatch[1].trim()} -> ${columnName}.`
        : "Which column should I move that task to?"
    };
  }

  const assignMatch = text.match(/\bassign\s+"?([^"]+?)"?\s+to\s+([a-z ]+)$/i);
  if (assignMatch) {
    const assigneeName = matchUser(assignMatch[2], context.knownUsers);
    return {
      intent: "ASSIGN_TASK",
      confidence: assigneeName ? 0.94 : 0.66,
      task: { ...emptyTask, assigneeName },
      targetTask: { titleOrId: assignMatch[1].trim() },
      query: null,
      responseMessage: assigneeName
        ? `Assigned: ${assignMatch[1].trim()} -> ${assigneeName}.`
        : "Who should own that task?"
    };
  }

  if (/\b(add|create)\b.*\b(task|card)\b/.test(lower)) {
    return parseCreate(text, context, now);
  }

  return base("UNKNOWN", 0.35, "I am not sure what board action you want. Can you rephrase it?");
}

function parseCreate(text: string, context: CommandContext, now: Date): ParsedBoardCommand {
  const forMatch = text.match(/\bfor\s+([a-z]+)\s+to\s+(.+)$/i);
  const needsMatch = text.match(/\b([a-z]+)\s+needs\s+to\s+(.+)$/i);
  let assigneeName = forMatch ? matchUser(forMatch[1], context.knownUsers) : null;
  let titleSource = forMatch?.[2] ?? text.replace(/^.*?\b(card|task):?\s*/i, "");

  if (needsMatch) {
    assigneeName = matchUser(needsMatch[1], context.knownUsers);
    titleSource = needsMatch[2];
  }

  const due = parseNaturalDueDate(titleSource, now);
  const title = cleanTaskTitle(titleSource);
  const priority = /\burgent|asap|critical\b/i.test(text) ? "URGENT" : /\bhigh priority\b/i.test(text) ? "HIGH" : "MEDIUM";

  return {
    intent: "CREATE_TASK",
    confidence: title.length > 3 ? 0.95 : 0.55,
    task: {
      ...emptyTask,
      title,
      assigneeName,
      priority,
      dueDateNaturalLanguage: due.natural,
      dueDateISO: due.iso,
      columnName: "To Do",
      isBlocked: false
    },
    targetTask: { titleOrId: null },
    query: null,
    responseMessage: `Added: ${title}${assigneeName ? ` -> ${assigneeName}` : ""}${due.natural ? `, due ${due.label}` : ""}.`
  };
}

function parseNaturalDueDate(text: string, now: Date) {
  const lower = text.toLowerCase();
  let date: Date | null = null;
  let natural: string | null = null;
  let label = "";

  if (/\btomorrow\b/.test(lower)) {
    date = addDays(now, 1);
    natural = "tomorrow";
    label = "tomorrow";
  } else if (/\bbefore friday\b|\bby friday\b/.test(lower)) {
    const friday = nextFriday(now);
    date = isBefore(friday, now) ? addDays(friday, 7) : friday;
    natural = lower.includes("before friday") ? "before Friday" : "by Friday";
    label = "Friday";
  } else if (/\btoday\b/.test(lower)) {
    date = now;
    natural = "today";
    label = "today";
  }

  if (!date) {
    return { iso: null, natural, label };
  }

  const due = setMinutes(setHours(date, 17), 0);
  return { iso: formatISO(due), natural, label };
}

function cleanTaskTitle(value: string) {
  return capitalize(
    value
      .replace(/\b(before|by)\s+friday\b/gi, "")
      .replace(/\btomorrow\b/gi, "")
      .replace(/\btoday\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function matchUser(value: string, users: CommandContext["knownUsers"]) {
  const normalized = value.trim().toLowerCase();
  return users.find((user) => user.name.toLowerCase() === normalized)?.name ?? capitalize(normalized);
}

function matchColumn(value: string, columns: string[]) {
  const normalized = value.trim().toLowerCase();
  return columns.find((column) => column.toLowerCase() === normalized) ?? null;
}

function base(intent: ParsedBoardCommand["intent"], confidence: number, responseMessage: string): ParsedBoardCommand {
  return {
    intent,
    confidence,
    task: null,
    targetTask: null,
    query: null,
    responseMessage
  };
}

function capitalize(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1) : trimmed;
}
