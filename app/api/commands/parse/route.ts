import { NextResponse } from "next/server";
import { parseBoardCommand } from "@/lib/parseBoardCommand";
import { getCommandContext } from "@/lib/services/commandContext";
import { parseCommandRequestSchema } from "@/lib/validators/boardIntent";

export async function POST(request: Request) {
  const body = parseCommandRequestSchema.parse(await request.json());
  const context = await getCommandContext();
  const parsed = await parseBoardCommand({
    rawText: body.rawText,
    discordUser: body.discordUser,
    knownUsers: context.knownUsers,
    knownTasks: context.knownTasks,
    columns: context.columns
  });

  return NextResponse.json(parsed);
}
