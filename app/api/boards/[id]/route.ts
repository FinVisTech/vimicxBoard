import { NextResponse } from "next/server";
import { getBoardSnapshot } from "@/lib/services/bootstrap";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const board = await getBoardSnapshot(id);
  return NextResponse.json(board);
}
