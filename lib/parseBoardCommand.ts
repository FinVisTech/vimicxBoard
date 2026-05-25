import { addDays, format, formatISO, isBefore, nextFriday, setHours, setMinutes } from "date-fns";
import { getLlmClient, type LlmClient, type LlmMessage } from "@/lib/llm/client";
import { parsedBoardCommandSchema, type ParsedBoardCommand } from "@/lib/validators/boardIntent";

type CommandContext = {
  rawText: string;
  discordUser?: { id: string; username: string; displayName?: string };
  knownUsers: Array<{ id: string; name: string; discordUserId?: string | null }>;
  knownTasks: Array<{
    id: string;
    title: string;
    columnName: string;
    assigneeName?: string | null;
    priority?: string;
    isBlocked?: boolean;
    blockerReason?: string | null;
    dueDate?: string | null;
  }>;
  columns: string[];
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
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

function buildSystemPrompt(context: CommandContext, now: Date): string {
  const taskLines = context.knownTasks.length === 0
    ? "  (board is empty)"
    : context.knownTasks.map((t) => {
        const parts = [`[${t.columnName}] "${t.title}"`];
        if (t.assigneeName) parts.push(`owner: ${t.assigneeName}`);
        if (t.priority && t.priority !== "MEDIUM") parts.push(`priority: ${t.priority}`);
        if (t.isBlocked) parts.push(`BLOCKED${t.blockerReason ? `: ${t.blockerReason}` : ""}`);
        if (t.dueDate) parts.push(`due: ${format(new Date(t.dueDate), "MMM d")}`);
        return `  - ${parts.join(" | ")}`;
      }).join("\n");

  const userLines = context.knownUsers.length === 0
    ? "  (no team members added yet)"
    : context.knownUsers.map((u) => `  - ${u.name}`).join("\n");

  const columnList = context.columns.join(", ");

  return `You are vimicxBoard, a Discord bot that manages a kanban task board for the Vimicx team. Today is ${format(now, "EEEE, MMMM d yyyy")}.

## Live Board State
Columns: ${columnList}

Team members:
${userLines}

Active tasks:
${taskLines}

## How to behave
- Only act on messages that are clear commands TO you. If someone is describing you or talking about you in conversation (e.g. "the bot will handle tasks for us", "@bot will add any task"), return intent UNKNOWN, confidence 0.05, responseMessage null — stay completely silent.
- When you complete an action, start responseMessage with "Done — " followed by a brief, human description of what you did.
- When a message is genuinely ambiguous, ask exactly one short clarifying question in responseMessage. Never take action on something you're not confident about.
- Answer questions about the board using the live task data above. Be accurate and specific — don't invent tasks or people.
- Keep responseMessage short and natural. Think how a smart colleague would reply in a team chat, not a robot.

## Output format (always return valid JSON)
{
  "intent": "CREATE_TASK" | "UPDATE_TASK" | "MOVE_TASK" | "ASSIGN_TASK" | "COMMENT_TASK" | "QUERY_TASKS" | "GENERATE_SUMMARY" | "UNKNOWN",
  "confidence": 0.0–1.0,
  "task": { "title", "description", "assigneeName", "priority", "dueDateNaturalLanguage", "dueDateISO", "columnName", "isBlocked", "blockerReason" } | null,
  "targetTask": { "titleOrId" } | null,
  "query": { "assigneeName", "status", "timeframe" } | null,
  "responseMessage": "string" | null
}
Use null for unused fields. dueDateISO must be ISO 8601 or null.`;
}

export async function parseBoardCommand(context: CommandContext): Promise<ParsedBoardCommand> {
  const heuristic = parseWithHeuristics(context);
  if (heuristic.confidence >= 0.9 || !process.env.OPENAI_API_KEY) {
    return heuristic;
  }

  const now = context.now ?? new Date();

  try {
    const client = context.llmClient ?? getLlmClient();

    const messages: LlmMessage[] = [
      { role: "system", content: buildSystemPrompt(context, now) },
      ...(context.conversationHistory ?? []).slice(-6),
      {
        role: "user",
        content: JSON.stringify({
          rawText: context.rawText,
          sentBy: context.discordUser?.displayName ?? context.discordUser?.username ?? "unknown",
          todayISO: formatISO(now)
        })
      }
    ];

    const result = await client.completeJson(messages);
    return parsedBoardCommandSchema.parse(result);
  } catch {
    return heuristic;
  }
}

export function parseWithHeuristics(context: CommandContext): ParsedBoardCommand {
  const raw = context.rawText.replace(/<@!?\d+>|@board/gi, "").trim();
  const text = raw.replace(/[""]/g, "\"");
  const lower = text.toLowerCase();
  const now = context.now ?? new Date();

  if (/\b(summarize|summary|daily sync)\b/.test(lower)) {
    return base("GENERATE_SUMMARY", 0.92, "Here's a quick rundown.");
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
        ? `Done — moved "${moveMatch[1].trim()}" to ${columnName}.`
        : "Which column should I move that to?"
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
        ? `Done — assigned "${assignMatch[1].trim()}" to ${assigneeName}.`
        : "Who should own that task?"
    };
  }

  // Explicit "add task: title" / "create task: title" format gets high confidence
  const explicitCreate = text.match(/\b(add|create)\s+task:\s*(.+)$/i);
  if (explicitCreate) {
    return parseCreate(explicitCreate[2], context, now, 0.95);
  }

  // Looser "add/create ... task/card" pattern — low confidence so LLM decides
  if (/\b(add|create)\b.*\b(task|card)\b/.test(lower)) {
    return parseCreate(text, context, now, 0.7);
  }

  return base("UNKNOWN", 0.35, null);
}

function parseCreate(text: string, context: CommandContext, now: Date, confidence: number): ParsedBoardCommand {
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
    confidence: title.length > 3 ? confidence : 0.55,
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
    responseMessage: `Done — added "${title}"${assigneeName ? ` for ${assigneeName}` : ""}${due.natural ? `, due ${due.label}` : ""}.`
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

function base(intent: ParsedBoardCommand["intent"], confidence: number, responseMessage: string | null): ParsedBoardCommand {
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
