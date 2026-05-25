import "dotenv/config";
import { Client, Events, GatewayIntentBits, TextChannel } from "discord.js";
import { handleDiscordBoardCommand } from "../lib/services/discordCommandService";
import { pollNotesBotCalls } from "../lib/services/notesbotService";
import { logger } from "../lib/logger";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const POLL_INTERVAL_MS = parseInt(process.env.NOTESBOT_POLL_INTERVAL_MS ?? "300000");

// Per-channel conversation history (last 6 messages = 3 turns)
type HistoryEntry = { role: "user" | "assistant"; content: string };
const channelHistory = new Map<string, HistoryEntry[]>();

function getHistory(channelId: string): HistoryEntry[] {
  return channelHistory.get(channelId) ?? [];
}

function pushHistory(channelId: string, role: "user" | "assistant", content: string) {
  const history = channelHistory.get(channelId) ?? [];
  history.push({ role, content });
  if (history.length > 6) history.splice(0, history.length - 6);
  channelHistory.set(channelId, history);
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Vimicx Board bot logged in as ${readyClient.user.tag}`);

  const hasApiKey = !!process.env.NOTESBOT_API_KEY;
  await logger.info("SYSTEM", `Bot online as ${readyClient.user.tag}`, {
    pollIntervalSec: POLL_INTERVAL_MS / 1000,
    notesbotEnabled: hasApiKey
  });

  if (!hasApiKey) {
    await logger.warn("SYSTEM", "NOTESBOT_API_KEY not set — polling disabled");
    return;
  }

  console.log(`[notesbot] Polling every ${POLL_INTERVAL_MS / 1000}s`);

  setInterval(async () => {
    try {
      const result = await pollNotesBotCalls();
      if (result.newCalls === 0) return;

      console.log(`[notesbot] Processed ${result.newCalls} call(s), ${result.newPendingTasks} action item(s) queued`);

      const channelId = process.env.NOTESBOT_REVIEW_CHANNEL_ID;
      if (!channelId || result.newPendingTasks === 0) return;

      const channel = await client.channels.fetch(channelId);
      if (channel instanceof TextChannel) {
        const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
        await channel.send(
          `**Meeting Review** — ${result.newPendingTasks} action item(s) extracted from ${result.newCalls} meeting(s) and queued for review.\n${appUrl}/review`
        );
      }
    } catch (err) {
      console.error("[notesbot] Poll error:", err);
    }
  }, POLL_INTERVAL_MS);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !client.user) return;
  const mentioned = message.mentions.users.has(client.user.id) || /(^|\s)@board\b/i.test(message.content);
  if (!mentioned) return;

  const channelId = message.channelId;
  const history = getHistory(channelId);

  try {
    const response = await handleDiscordBoardCommand({
      rawText: message.content,
      discordUser: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.member?.displayName
      },
      conversationHistory: history
    });

    // Stay silent if the bot determined it shouldn't respond
    if (!response.message) return;

    const reply = response.message.slice(0, 1900);
    await message.reply(reply);

    // Update history with this exchange
    pushHistory(channelId, "user", message.content);
    pushHistory(channelId, "assistant", reply);
  } catch (error) {
    console.error(error);
    await message.reply("Something went wrong on my end. Check the bot logs.");
  }
});

void client.login(token);
