import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const pendingTasks = await prisma.pendingTask.findMany({
    where: { status: "PENDING" },
    include: { meetingCall: true },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json(pendingTasks);
}
