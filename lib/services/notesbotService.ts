import { prisma } from "@/lib/prisma";
import { getLlmClient } from "@/lib/llm/client";
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
  assigneeName: string | null;
  priority: Priority;
};

async function fetchNotesBotCalls(apiKey: string, guildId: string, from?: Date): Promise<NotesBotCallListItem[]> {
  const params = new URLSearchParams({ server_id: guildId, per_page: "100" });
  if (from) params.set("from", from.toISOString());

  const res = await fetch(`${NOTESBOT_API_BASE}/v1/calls?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });

  if (!res.ok) throw new Error(`NotesBot API error: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json.data as NotesBotCallListItem[];
}

async function fetchNotesBotCallDetail(apiKey: string, callId: string): Promise<NotesBotCallDetail> {
  const res = await fetch(`${NOTESBOT_API_BASE}/v1/calls/${callId}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  if (!res.ok) throw new Error(`NotesBot API error fetching call ${callId}: ${res.status}`);
  const json = await res.json();
  return json.data as NotesBotCallDetail;
}

export async function extractTasksFromTranscript(
  summary: string,
  transcript: string,
  participants: string[]
): Promise<ExtractedTask[]> {
  const llm = getLlmClient();

  const result = await llm.completeJson([
    {
      role: "system",
      content:
        "You extract concrete action items from meeting transcripts. Return a JSON object with a `tasks` array. Each task has: title (short verb phrase, max 80 chars), description (1-2 sentences of context or null), assigneeName (exact name of person responsible from participant list or null), priority (LOW, MEDIUM, HIGH, or URGENT — default MEDIUM). Only include tasks with a clear owner or deliverable. Exclude vague discussion points."
    },
    {
      role: "user",
      content: JSON.stringify({ summary, transcript, participants })
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
      assigneeName: t.assigneeName ? String(t.assigneeName) : null,
      priority: validPriorities.has(String(t.priority)) ? (String(t.priority) as Priority) : "MEDIUM"
    }))
    .filter((t) => t.title.length > 2);
}

export async function pollNotesBotCalls(): Promise<{ newCalls: number; newPendingTasks: number }> {
  const apiKey = process.env.NOTESBOT_API_KEY;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!apiKey || !guildId) {
    console.warn("[notesbot] NOTESBOT_API_KEY or DISCORD_GUILD_ID not set, skipping poll");
    return { newCalls: 0, newPendingTasks: 0 };
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: "default-workspace" } });
  const lastPolled = workspace?.notesbotLastPolledAt ?? undefined;

  const calls = await fetchNotesBotCalls(apiKey, guildId, lastPolled);

  const existingIds = new Set(
    (await prisma.meetingCall.findMany({ select: { notesbotCallId: true } })).map((c) => c.notesbotCallId)
  );

  const newCalls = calls.filter((c) => !existingIds.has(c.id));

  let totalPendingTasks = 0;

  for (const call of newCalls) {
    try {
      const detail = await fetchNotesBotCallDetail(apiKey, call.id);
      const participantNames = detail.participants.map((p) => p.display_name || p.username);
      const tasks = await extractTasksFromTranscript(detail.summary, detail.transcript, participantNames);

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
              assigneeName: t.assigneeName,
              priority: t.priority
            }))
          });
        }

        totalPendingTasks += tasks.length;
      });
    } catch (err) {
      console.error(`[notesbot] Failed to process call ${call.id}:`, err);
    }
  }

  await prisma.workspace.update({
    where: { id: "default-workspace" },
    data: { notesbotLastPolledAt: new Date() }
  });

  return { newCalls: newCalls.length, newPendingTasks: totalPendingTasks };
}
