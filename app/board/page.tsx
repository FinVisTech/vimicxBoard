import { BoardClient } from "@/components/BoardClient";
import { getBoardSnapshot } from "@/lib/services/bootstrap";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const board = await getBoardSnapshot();

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Team memory</p>
          <h1 className="text-3xl font-bold tracking-normal">{board.name}</h1>
        </div>
        <p className="max-w-xl text-sm leading-6 text-slate-600">
          Mention <span className="font-semibold">@board</span> in Discord to add, move, assign, query, or summarize work.
        </p>
      </div>
      <BoardClient board={JSON.parse(JSON.stringify(board))} />
    </main>
  );
}
