import { NextResponse } from "next/server";
import { updateTaskComment } from "@/lib/services/taskService";
import { updateCommentSchema } from "@/lib/validators/tasks";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = updateCommentSchema.parse(await request.json());
  const comment = await updateTaskComment(id, body);
  return NextResponse.json(comment);
}
