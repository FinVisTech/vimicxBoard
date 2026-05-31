import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  const data = updatePendingTaskSchema.parse(await request.json());
  const pendingTask = await prisma.pendingTask.findUnique({ where: { id } });

  if (!pendingTask) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pendingTask.status !== "PENDING") {
    return NextResponse.json({ error: "Already reviewed" }, { status: 409 });
  }

  const updated = await prisma.pendingTask.update({
    where: { id },
    data,
    include: { meetingCall: true }
  });

  return NextResponse.json(updated);
}
