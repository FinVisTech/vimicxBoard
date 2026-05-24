import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/services/taskService";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const pending = await prisma.pendingTask.findUnique({ where: { id } });
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });

  const task = await createTask({
    title: pending.title,
    description: pending.description,
    assigneeName: pending.assigneeName,
    priority: pending.priority,
    columnName: "Backlog",
    source: "AGENT"
  });

  await prisma.pendingTask.update({
    where: { id },
    data: { status: "APPROVED", taskId: task.id, reviewedAt: new Date() }
  });

  return NextResponse.json({ task });
}
