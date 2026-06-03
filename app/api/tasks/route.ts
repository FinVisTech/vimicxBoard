import { NextResponse } from "next/server";
import { createTask } from "@/lib/services/taskService";

export async function POST(request: Request) {
  try {
    const task = await createTask(await request.json());
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("DM recipients") || error.message.includes("DM notifications"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
