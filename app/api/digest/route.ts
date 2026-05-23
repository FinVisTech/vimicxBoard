import { NextResponse } from "next/server";
import { buildDailyDigest } from "@/lib/services/digestService";

export async function GET() {
  return NextResponse.json(await buildDailyDigest());
}
