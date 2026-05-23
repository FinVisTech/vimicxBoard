import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const board = await ensureDefaultBoard();
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="mx-auto max-w-4xl px-5 py-8">
      <h1 className="text-3xl font-bold">Settings</h1>
      <div className="mt-6 grid gap-5">
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">Discord</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Row label="Guild ID" value={board.workspace.discordGuildId ?? "Set DISCORD_GUILD_ID"} />
            <Row label="Digest Channel ID" value={board.workspace.discordChannelId ?? "Set DISCORD_CHANNEL_ID"} />
            <Row label="Mon/Fri Digest" value={`${board.workspace.dailyDigestTime} ${board.workspace.timezone}`} />
          </dl>
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">People</h2>
          <div className="mt-4 grid gap-2">
            {users.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span className="font-semibold">{user.name}</span>
                <span className="text-slate-500">{user.discordUserId ? `Discord ${user.discordUserId}` : "No Discord link"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="font-semibold text-slate-600">{label}</dt>
      <dd className="text-right text-slate-900">{value}</dd>
    </div>
  );
}
