import { BoardClient } from "@/components/BoardClient";
import { getBoardSnapshot } from "@/lib/services/bootstrap";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const board = await getBoardSnapshot();

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <BoardClient board={JSON.parse(JSON.stringify(board))} />
    </main>
  );
}
