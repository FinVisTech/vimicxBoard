import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`select 1`;

    const [workspaceCount, boardCount, taskCount] = await Promise.all([
      prisma.workspace.count(),
      prisma.board.count(),
      prisma.task.count()
    ]);

    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      databaseUrl: describeDatabaseUrl(databaseUrl),
      counts: {
        workspaces: workspaceCount,
        boards: boardCount,
        tasks: taskCount
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        latencyMs: Date.now() - startedAt,
        databaseUrl: describeDatabaseUrl(databaseUrl),
        error: sanitizeError(error)
      },
      { status: 500 }
    );
  }
}

function describeDatabaseUrl(value: string) {
  if (!value) {
    return { present: false };
  }

  try {
    const url = new URL(value.replace(/^"|"$/g, ""));
    return {
      present: true,
      protocol: url.protocol,
      host: url.host,
      database: url.pathname.replace(/^\//, ""),
      sslmode: url.searchParams.get("sslmode"),
      looksQuoted: value.startsWith("\"") || value.endsWith("\"")
    };
  } catch {
    return {
      present: true,
      parseable: false,
      looksQuoted: value.startsWith("\"") || value.endsWith("\"")
    };
  }
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    name: error instanceof Error ? error.name : "UnknownError",
    message: message.replace(process.env.DATABASE_URL ?? "", "[DATABASE_URL]")
  };
}
