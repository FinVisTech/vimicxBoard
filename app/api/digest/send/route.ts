import { NextResponse } from "next/server";
import { sendDigestToDiscord } from "@/lib/services/digestService";

export async function POST(request: Request) {
  const secret = request.headers.get("x-cron-secret") ?? new URL(request.url).searchParams.get("secret");
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await sendDigestToDiscord());
}
