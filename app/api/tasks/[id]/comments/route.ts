import { NextResponse } from "next/server";
import { addTaskComment } from "@/lib/services/taskService";
import { createCommentSchema } from "@/lib/validators/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = createCommentSchema.parse(await request.json());
  const comment = await addTaskComment(id, body);
  return NextResponse.json(comment, { status: 201 });
}
