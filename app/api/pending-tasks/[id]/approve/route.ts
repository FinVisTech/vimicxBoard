import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { resolveExistingUsersByNames } from "@/lib/services/pendingTaskAssignees";
import { createTask, addTaskComment } from "@/lib/services/taskService";
import { sendTaskAssignmentDms } from "@/lib/services/taskAcceptanceService";

const approvePendingTaskSchema = z.object({
  dmUserIds: z.array(z.string()).optional()
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = approvePendingTaskSchema.parse(await req.json().catch(() => ({})));

  const pending = await prisma.pendingTask.findUnique({ where: { id } });
  if (!pending) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pending.status !== "PENDING") return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  const { users: assignees } = await resolveExistingUsersByNames(pending.assigneeName);
  const assigneeIds = assignees.map((user) => user.id);
  const dmUserIds = [...new Set((body.dmUserIds ?? []).filter(Boolean))];

  if (dmUserIds.some((userId) => !assigneeIds.includes(userId))) {
    return NextResponse.json({ error: "DM recipients must already be task owners." }, { status: 400 });
  }

  const task = await createTask({
    title: pending.title,
    description: pending.description,
    assigneeIds,
    priority: pending.priority,
    columnName: "Backlog",
    source: "AGENT"
  });

  if (dmUserIds.length > 0) {
    await sendTaskAssignmentDms(task.id, dmUserIds);
  }

  if (pending.contextNotes) {
    await addTaskComment(task.id, {
      body: `**Meeting context:**\n\n${pending.contextNotes}`,
      source: "AGENT"
    });
  }

  await prisma.pendingTask.update({
    where: { id },
    data: { status: "APPROVED", taskId: task.id, reviewedAt: new Date() }
  });

  return NextResponse.json({ task });
}
