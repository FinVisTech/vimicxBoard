"use client";

import { useEffect, useRef, useState } from "react";

type User = { id: string; name: string };

export function TaskOwnerField({
  taskId,
  initialAssigneeId,
  initialAssigneeName,
  users
}: {
  taskId: string;
  initialAssigneeId: string | null;
  initialAssigneeName: string | null;
  users: User[];
}) {
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [assigneeName, setAssigneeName] = useState(initialAssigneeName);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim().length === 0
    ? users
    : users.filter((u) => u.name.toLowerCase().includes(query.toLowerCase()));

  // Focus input when editing starts
  useEffect(() => {
    if (editing) {
      setQuery("");
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [editing]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setEditing(false);
        setError(null);
      }
    }
    if (editing) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [editing]);

  async function save(user: User | null) {
    setEditing(false);
    setIsSaving(true);
    setError(null);

    const prev = { id: assigneeId, name: assigneeName };
    setAssigneeId(user?.id ?? null);
    setAssigneeName(user?.name ?? null);

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeId: user?.id ?? null, source: "WEB" })
    });

    setIsSaving(false);
    if (!res.ok) {
      setAssigneeId(prev.id);
      setAssigneeName(prev.name);
      setError("Could not save owner.");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlighted]) save(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setEditing(false);
      setError(null);
    }
  }

  if (editing) {
    return (
      <div ref={containerRef} className="relative rounded-md bg-slate-50 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Type a name…"
          className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400"
        />
        {filtered.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
            {filtered.map((u, i) => (
              <li key={u.id}>
                <button
                  onMouseDown={(e) => { e.preventDefault(); save(u); }}
                  onMouseEnter={() => setHighlighted(i)}
                  className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                    i === highlighted ? "bg-primary text-white" : "text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {u.name}
                </button>
              </li>
            ))}
            {assigneeId && (
              <li className="border-t border-border">
                <button
                  onMouseDown={(e) => { e.preventDefault(); save(null); }}
                  className="w-full px-4 py-2.5 text-left text-xs font-semibold text-slate-400 hover:bg-slate-50 hover:text-red-500 transition-colors"
                >
                  Remove owner
                </button>
              </li>
            )}
          </ul>
        )}
        {filtered.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
            <p className="text-sm text-slate-400">No match — only team members in Settings can be assigned.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owner</p>
      <button
        onDoubleClick={() => setEditing(true)}
        title="Double-click to change owner"
        className="mt-1 w-full text-left text-sm font-semibold text-slate-900 outline-none"
      >
        {isSaving ? "Saving…" : (assigneeName ?? "Unassigned")}
      </button>
      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-slate-400 opacity-0 group-hover:opacity-100">Double-click to edit</p>
    </div>
  );
}
