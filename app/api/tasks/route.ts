import { NextResponse } from "next/server";
import { createTask } from "@/lib/services/taskService";

export async function POST(request: Request) {
  const task = await createTask(await request.json());
  return NextResponse.json(task, { status: 201 });
}
