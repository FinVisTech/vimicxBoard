import { BoardClient } from "@/components/BoardClient";
import { prisma } from "@/lib/prisma";
import { getBoardSnapshot } from "@/lib/services/bootstrap";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const [board, users] = await Promise.all([
    getBoardSnapshot(),
    prisma.user.findMany({ orderBy: { name: "asc" } })
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <BoardClient board={JSON.parse(JSON.stringify(board))} allUsers={users} />
    </main>
  );
}
