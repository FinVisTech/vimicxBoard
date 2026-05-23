import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTask } from "@/lib/services/taskService";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await prisma.task.findUniqueOrThrow({
    where: { id },
    include: {
      assignee: true,
      createdBy: true,
      column: true,
      comments: { include: { user: true }, orderBy: { createdAt: "desc" } },
      activity: { include: { actor: true }, orderBy: { createdAt: "desc" } }
    }
  });
  return NextResponse.json(task);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const task = await updateTask(id, await request.json());
  return NextResponse.json(task);
}
