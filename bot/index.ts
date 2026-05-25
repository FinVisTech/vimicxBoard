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

  try {
    const response = await handleDiscordBoardCommand({
      rawText: message.content,
      discordUser: {
        id: message.author.id,
        username: message.author.username,
        displayName: message.member?.displayName
      }
    });
    await message.reply(response.message.slice(0, 1900));
  } catch (error) {
    console.error(error);
    await message.reply("I hit an error while updating the board. Check the bot logs.");
  }
});

void client.login(token);
