import { prisma } from "@/lib/prisma";
import { ComposeMessage } from "@/components/ComposeMessage";

export const dynamic = "force-dynamic";

export default async function ComposePage() {
  const workspace = await prisma.workspace.findFirst().catch(() => null);
  const defaultChannelId = workspace?.discordChannelId ?? process.env.DISCORD_CHANNEL_ID ?? "";

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-3xl font-bold">Compose</h1>
      <p className="mt-1 text-sm text-slate-500">
        Write a message, preview it, then confirm before it posts to Discord.
      </p>
      <div className="mt-6 rounded-lg border border-border bg-white p-6">
        <ComposeMessage defaultChannelId={defaultChannelId} />
      </div>
    </main>
  );
}
