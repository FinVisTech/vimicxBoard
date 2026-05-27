"use client";

import { useState } from "react";

type User = { id: string; name: string };

export function TaskOwnerSelect({
  taskId,
  initialAssigneeId,
  users
}: {
  taskId: string;
  initialAssigneeId: string | null;
  users: User[];
}) {
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateOwner(nextId: string) {
    const previous = assigneeId;
    setAssigneeId(nextId);
    setIsSaving(true);
    setError(null);

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: nextId || null, source: "WEB" })
    });

    setIsSaving(false);
    if (!res.ok) {
      setAssigneeId(previous);
      setError("Could not save owner.");
    }
  }

  const current = users.find((u) => u.id === assigneeId);

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="task-owner">
        Owner
      </label>
      <select
        id="task-owner"
        value={assigneeId}
        onChange={(e) => updateOwner(e.target.value)}
        disabled={isSaving}
        className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 outline-none transition-colors hover:bg-slate-200 disabled:opacity-50"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {current && (
        <button
          onClick={() => updateOwner("")}
          disabled={isSaving}
          className="text-xs text-slate-400 hover:text-red-500 disabled:opacity-50"
        >
          Remove owner
        </button>
      )}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
