import "dotenv/config";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleDiscordBoardCommand } from "../lib/services/discordCommandService";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is required");
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Vimicx Board bot logged in as ${readyClient.user.tag}`);
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
