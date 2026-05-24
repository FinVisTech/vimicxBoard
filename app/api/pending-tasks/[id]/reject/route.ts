import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pending = await prisma.pendingTask.findUnique({ where: { id } });
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  await prisma.pendingTask.update({
    where: { id },
    data: { status: "REJECTED", reviewedAt: new Date() }
  });

  return NextResponse.json({ ok: true });
}
