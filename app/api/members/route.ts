import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const members = await prisma.user.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(members);
}

export async function POST(req: Request) {
  const { name, discordUserId } = await req.json();

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const trimmedName = name.trim();
  const trimmedDiscordId = typeof discordUserId === "string" ? discordUserId.trim() || null : null;

  try {
    const member = await prisma.user.create({
      data: { name: trimmedName, discordUserId: trimmedDiscordId }
    });
    return NextResponse.json(member, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Name or Discord ID already exists" }, { status: 409 });
  }
}
