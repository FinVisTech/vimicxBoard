import { NextResponse } from "next/server";
import { agentActionSchema } from "@/lib/validators/boardIntent";
import { createTask, updateTask, addTaskComment } from "@/lib/services/taskService";

const destructiveActions = new Set(["UPDATE_TASK", "MOVE_TASK"]);

export async function POST(request: Request) {
  const body = agentActionSchema.parse(await request.json());
  const autoApply = process.env.AGENT_AUTO_APPLY === "true";

  if (destructiveActions.has(body.action) && !autoApply && body.payload.confirmed !== true) {
    return NextResponse.json({
      status: "NEEDS_CONFIRMATION",
      message: `${body.agentName} suggested ${body.action}. Confirmation is required before applying it.`,
      suggestedAction: body
    });
  }

  if (body.action === "CREATE_TASK") {
    return NextResponse.json({ status: "APPLIED", result: await createTask({ ...body.payload, source: "AGENT" }) });
  }

  if (body.action === "UPDATE_TASK" || body.action === "MOVE_TASK") {
    const taskId = String(body.payload.taskId ?? "");
    return NextResponse.json({ status: "APPLIED", result: await updateTask(taskId, { ...body.payload, source: "AGENT" }) });
  }

  if (body.action === "COMMENT_TASK") {
    const taskId = String(body.payload.taskId ?? "");
    return NextResponse.json({
      status: "APPLIED",
      result: await addTaskComment(taskId, { body: String(body.payload.body ?? body.reasoningSummary), source: "AGENT" })
    });
  }

  return NextResponse.json({ status: "ACCEPTED", message: "Summary generation is read-only in v1." });
}
