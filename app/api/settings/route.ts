import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";
import { updateWorkspaceSettingsSchema } from "@/lib/validators/tasks";

export async function PATCH(request: Request) {
  const board = await ensureDefaultBoard();
  const data = updateWorkspaceSettingsSchema.parse(await request.json());
  const workspace = await prisma.workspace.update({
    where: { id: board.workspaceId },
    data
  });

  return NextResponse.json(workspace);
}
