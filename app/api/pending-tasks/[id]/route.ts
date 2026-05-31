import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  formatPendingAssigneeNames,
  resolveExistingUsersByIds,
  resolveExistingUsersByNames
} from "@/lib/services/pendingTaskAssignees";
import { updatePendingTaskSchema } from "@/lib/validators/pendingTasks";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pendingTask = await prisma.pendingTask.findUniqueOrThrow({
    where: { id },
    include: { meetingCall: true }
  });
  return NextResponse.json(pendingTask);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { assigneeIds, assigneeName, ...data } = updatePendingTaskSchema.parse(await request.json());
  const pendingTask = await prisma.pendingTask.findUnique({ where: { id } });

  if (!pendingTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pendingTask.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const updateData = { ...data, assigneeName };

  if (assigneeIds !== undefined) {
    const assignees = await resolveExistingUsersByIds(assigneeIds);
    if (!assignees) return NextResponse.json({ error: "Unknown assignee" }, { status: 400 });
    updateData.assigneeName = formatPendingAssigneeNames(assignees);
  } else if (assigneeName !== undefined) {
    const { users, unknownNames } = await resolveExistingUsersByNames(assigneeName);
    if (unknownNames.length > 0) return NextResponse.json({ error: "Unknown assignee" }, { status: 400 });
    updateData.assigneeName = formatPendingAssigneeNames(users);
  }

  const updated = await prisma.pendingTask.update({
    where: { id },
    data: updateData,
    include: { meetingCall: true }
  });

  return NextResponse.json(updated);
}
