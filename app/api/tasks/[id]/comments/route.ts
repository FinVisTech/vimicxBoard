import { NextResponse } from "next/server";
import { addTaskClarificationResponse } from "@/lib/services/taskAcceptanceService";
import { addTaskComment } from "@/lib/services/taskService";
import { createCommentSchema } from "@/lib/validators/tasks";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const raw = await request.json();
  const body = createCommentSchema.parse(raw);

  if (raw?.isClarification === true) {
    try {
      const result = await addTaskClarificationResponse(id, body);
      return NextResponse.json(result, { status: 201 });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Could not add clarification" },
        { status: 400 }
      );
    }
  }

  const comment = await addTaskComment(id, body);
  return NextResponse.json(comment, { status: 201 });
}
