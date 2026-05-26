import { prisma } from "@/lib/prisma";
import { getLlmClient } from "@/lib/llm/client";
import { logger } from "@/lib/logger";
import type { Priority } from "@prisma/client";

const NOTESBOT_API_BASE = "https://api.notesbot.io";

type NotesBotCallListItem = {
  id: string;
  summary: string;
  server_name: string;
  server_id: string;
  channel_name: string;
  channel_id: string;
  duration: number;
  participant_count: number;
  created_at: string;
};

type NotesBotCallDetail = NotesBotCallListItem & {
  transcript: string;
  participants: { display_name: string; username: string }[];
};

type ExtractedTask = {
  title: string;
  description: string | null;
  contextNotes: string | null;
  assigneeName: string | null;
  priority: Priority;
};

async function fetchNotesBotCalls(apiKey: string): Promise<NotesBotCallListItem[]> {
  const params = new URLSearchParams({ per_page: "100" });

  const res = await fetch(`${NOTESBOT_API_BASE}/v1/calls?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!res.ok) throw new Error(`NotesBot API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data as NotesBotCallListItem[];
}

async function fetchNotesBotCallDetail(apiKey: string, callId: string): Promise<NotesBotCallDetail> {
  const res = await fetch(`${NOTESBOT_API_BASE}/v1/calls/${callId}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!res.ok) throw new Error(`NotesBot API ${res.status} fetching call ${callId}`);
  const json = await res.json();
  return json.data as NotesBotCallDetail;
}

export async function extractTasksFromTranscript(
  summary: string,
  transcript: string,
  participants: string[]
): Promise<ExtractedTask[]> {
  const llm = getLlmClient();

  // ~320k chars ≈ 80k tokens — safe ceiling for gpt-4o-mini's 128k context
  const truncated = transcript.length > 320_000;
  const safeTranscript = truncated
    ? transcript.slice(0, 320_000) + "\n\n[transcript truncated]"
    : transcript;

  const result = await llm.completeJson([
    {
      role: "system",
      content:
        "You extract concrete action items from meeting transcripts. Return a JSON object with a `tasks` array. Each task has: title (short verb phrase, max 80 chars), description (1-2 sentence summary of what the task is, or null), contextNotes (a detailed paragraph capturing the full discussion around this task — include what was said about it, any specific decisions made, requirements mentioned, constraints, or direct quotes from participants that add useful context; null only if nothing further was discussed beyond the task title), assigneeName (exact name from the participant list of the person responsible, or null), priority (LOW, MEDIUM, HIGH, or URGENT — default MEDIUM). Only include tasks with a clear owner or deliverable. Exclude vague discussion points."
    },
    {
      role: "user",
      content: JSON.stringify({ summary, transcript: safeTranscript, participants })
    }
  ]);

  const raw = result as { tasks?: unknown[] };
  if (!Array.isArray(raw.tasks)) return [];

  const validPriorities = new Set(["LOW", "MEDIUM", "HIGH", "URGENT"]);

  return raw.tasks
    .filter((t): t is Record<string, unknown> => typeof t === "object" && t !== null)
    .map((t) => ({
      title: String(t.title ?? "").slice(0, 80),
      description: t.description ? String(t.description) : null,
      contextNotes: t.contextNotes ? String(t.contextNotes) : null,
      assigneeName: t.assigneeName ? String(t.assigneeName) : null,
      priority: validPriorities.has(String(t.priority)) ? (String(t.priority) as Priority) : "MEDIUM"
    }))
    .filter((t) => t.title.length > 2);
}

export async function pollNotesBotCalls(): Promise<{ newCalls: number; newPendingTasks: number }> {
  const apiKey = process.env.NOTESBOT_API_KEY;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!apiKey) {
    await logger.warn("POLL", "Skipped — NOTESBOT_API_KEY not set");
    return { newCalls: 0, newPendingTasks: 0 };
  }

  await logger.info("POLL", "Poll started");

  let totalNewCalls = 0;
  let totalPendingTasks = 0;

  try {
    await logger.info("API", "GET /v1/calls → fetching all calls for account");
    const calls = await fetchNotesBotCalls(apiKey);
    await logger.info("API", `GET /v1/calls → ${calls.length} call(s) returned`);

    const existingIds = new Set(
      (await prisma.meetingCall.findMany({ select: { notesbotCallId: true } })).map((c) => c.notesbotCallId)
    );

    const newCalls = calls.filter((c) => !existingIds.has(c.id));
    totalNewCalls = newCalls.length;

    if (newCalls.length === 0) {
      await logger.info("POLL", "No new calls — nothing to process");
    } else {
      await logger.info("POLL", `${newCalls.length} new call(s) to process`);
    }

    for (const call of newCalls) {
      await logger.info("API", `GET /v1/calls/${call.id} → fetching detail`, { channel: call.channel_name });

      try {
        const detail = await fetchNotesBotCallDetail(apiKey, call.id);
        await logger.info("API", `Transcript received`, {
          channel: detail.channel_name,
          chars: detail.transcript.length,
          participants: detail.participants.length,
          truncated: detail.transcript.length > 320_000
        });

        await logger.info("LLM", `Extracting tasks from "${detail.channel_name}" transcript...`);
        const tasks = await extractTasksFromTranscript(detail.summary, detail.transcript,
          detail.participants.map((p) => p.display_name || p.username)
        );
        await logger.info("LLM", `Extracted ${tasks.length} task(s)`, {
          tasks: tasks.map((t) => t.title)
        });

        await logger.info("DB", `Saving MeetingCall + ${tasks.length} PendingTask(s)...`);
        await prisma.$transaction(async (tx) => {
          const meetingCall = await tx.meetingCall.create({
            data: {
              notesbotCallId: detail.id,
              serverName: detail.server_name,
              channelName: detail.channel_name,
              durationSeconds: detail.duration,
              participantCount: detail.participant_count,
              summary: detail.summary,
              transcript: detail.transcript,
              recordedAt: new Date(detail.created_at)
            }
          });

          if (tasks.length > 0) {
            await tx.pendingTask.createMany({
              data: tasks.map((t) => ({
                meetingCallId: meetingCall.id,
                title: t.title,
                description: t.description,
                contextNotes: t.contextNotes,
                assigneeName: t.assigneeName,
                priority: t.priority
              }))
            });
          }

          totalPendingTasks += tasks.length;
        });
        await logger.info("DB", `Saved — MeetingCall ${call.id} + ${tasks.length} task(s) queued for review`);

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await logger.error("POLL", `Failed to process call ${call.id}: ${msg}`);
      }
    }

    await prisma.workspace.upsert({
      where: { id: "default-workspace" },
      update: {},
      create: { id: "default-workspace", name: "Vimicx" }
    });

    await logger.info("POLL", `Poll complete — ${totalNewCalls} new call(s), ${totalPendingTasks} task(s) queued`);

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logger.error("POLL", `Poll failed: ${msg}`);
  }

  return { newCalls: totalNewCalls, newPendingTasks: totalPendingTasks };
}
