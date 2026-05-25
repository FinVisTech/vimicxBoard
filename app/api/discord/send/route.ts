import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { channelId, content } = await req.json();

  if (!channelId || typeof channelId !== "string" || channelId.trim().length === 0) {
    return NextResponse.json({ error: "channelId is required" }, { status: 400 });
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 2000) {
    return NextResponse.json({ error: "Message exceeds Discord's 2000 character limit" }, { status: 400 });
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "DISCORD_BOT_TOKEN not configured" }, { status: 500 });
  }

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId.trim()}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: content.trim() })
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `Discord rejected the message: ${res.status} ${text}` }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
