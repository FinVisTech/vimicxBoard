"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  name: string;
  discordUserId: string | null;
};

export function PeopleSettings({ initialMembers }: { initialMembers: Member[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    const res = await fetch("/api/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, discordUserId: discordUserId || null })
    });
    if (res.ok) {
      setName("");
      setDiscordUserId("");
      router.refresh();
    } else {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Failed to add member");
    }
    setAdding(false);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await fetch(`/api/members/${id}`, { method: "DELETE" });
    setDeletingId(null);
    setConfirmId(null);
    router.refresh();
  }

  return (
    <div className="mt-4 grid gap-4">
      {/* Existing members */}
      <div className="grid gap-2">
        {initialMembers.length === 0 && (
          <p className="text-sm text-slate-500">No team members added yet.</p>
        )}
        {initialMembers.map((m) => (
          <div key={m.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{m.name}</span>
              <span className="text-xs text-slate-500">
                {m.discordUserId ? `Discord ID: ${m.discordUserId}` : "No Discord ID"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {confirmId === m.id ? (
                <>
                  <span className="text-xs text-slate-500">Remove?</span>
                  <button
                    onClick={() => handleDelete(m.id)}
                    disabled={deletingId === m.id}
                    className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {deletingId === m.id ? "Removing…" : "Yes"}
                  </button>
                  <button
                    onClick={() => setConfirmId(null)}
                    className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmId(m.id)}
                  className="rounded-md border border-border px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="grid gap-3 rounded-md border border-dashed border-slate-300 p-4">
        <p className="text-sm font-semibold text-slate-600">Add team member</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            required
            placeholder="First name (as spoken in meetings)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <input
            placeholder="Discord User ID (18-digit number)"
            value={discordUserId}
            onChange={(e) => setDiscordUserId(e.target.value)}
            className="flex-1 rounded-md border border-border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={adding}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <p className="text-xs text-slate-400">
          To find a Discord User ID: enable Developer Mode in Discord settings, then right-click any user → Copy User ID.
        </p>
      </form>
    </div>
  );
}
