import { prisma } from "@/lib/prisma";
import { ensureDefaultBoard } from "@/lib/services/bootstrap";
import { ArchiveSettingsForm } from "@/components/ArchiveSettingsForm";
import { PeopleSettings } from "@/components/PeopleSettings";

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
          <h2 className="text-lg font-semibold">Archive</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Done tasks are archived automatically after this many days. Set it to 0 to archive Done tasks the next time the board refreshes.
          </p>
          <ArchiveSettingsForm initialDays={board.workspace.archiveDoneAfterDays} />
        </section>
        <section className="rounded-lg border border-border bg-white p-5">
          <h2 className="text-lg font-semibold">People</h2>
          <p className="mt-1 text-sm text-slate-500">
            Map meeting names to Discord user IDs so the bot can tag people in notifications.
          </p>
          <PeopleSettings initialMembers={users} />
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
