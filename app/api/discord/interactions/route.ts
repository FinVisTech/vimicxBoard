import { NextResponse } from "next/server";
import { handleDiscordBoardCommand } from "@/lib/services/discordCommandService";

export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.DISCORD_BOT_TOKEN && auth !== `Bearer ${process.env.DISCORD_BOT_TOKEN}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const result = await handleDiscordBoardCommand({
    rawText: String(body.content ?? body.rawText ?? ""),
    discordUser: {
      id: String(body.author?.id ?? body.discordUser?.id ?? "api-user"),
      username: String(body.author?.username ?? body.discordUser?.username ?? "api-user"),
      displayName: body.member?.displayName ?? body.discordUser?.displayName
    }
  });

  return NextResponse.json(result);
}
