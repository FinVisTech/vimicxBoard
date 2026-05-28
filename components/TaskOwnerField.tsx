"use client";

import { X, UserRound, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type User = { id: string; name: string };

export function TaskOwnerField({
  taskId,
  initialAssignees,
  users
}: {
  taskId: string;
  initialAssignees: User[];
  users: User[];
}) {
  const [assignees, setAssignees] = useState<User[]>(initialAssignees);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(assignees.map((u) => u.id));
  const filtered = users.filter(
    (u) => !assignedIds.has(u.id) && (query.trim().length === 0 || u.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (adding) {
      setQuery("");
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [adding]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setAdding(false);
        setError(null);
      }
    }
    if (adding) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [adding]);

  async function saveAssignees(next: User[]) {
    setIsSaving(true);
    setError(null);
    const prev = assignees;
    setAssignees(next);

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigneeIds: next.map((u) => u.id), source: "WEB" })
    });

    setIsSaving(false);
    if (!res.ok) {
      setAssignees(prev);
      setError("Could not save.");
    }
  }

  function addAssignee(user: User) {
    setAdding(false);
    saveAssignees([...assignees, user]);
  }

  function removeAssignee(userId: string) {
    saveAssignees(assignees.filter((u) => u.id !== userId));
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
      if (filtered[highlighted]) addAssignee(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setAdding(false);
      setError(null);
    }
  }

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {isSaving ? "Saving…" : "Owners"}
      </p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {assignees.length === 0 && !adding && (
          <span className="text-sm font-semibold text-slate-400">Unassigned</span>
        )}
        {assignees.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-full bg-white border border-border px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            <UserRound className="h-3 w-3 text-slate-400" />
            {u.name}
            <button
              type="button"
              onClick={() => removeAssignee(u.id)}
              className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-red-500 transition-colors"
              aria-label={`Remove ${u.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-400 hover:border-primary hover:text-primary transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add owner
          </button>
        )}
      </div>

      {adding && (
        <div ref={dropdownRef} className="relative mt-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search team members…"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25"
          />
          {filtered.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
              {filtered.map((u, i) => (
                <li key={u.id}>
                  <button
                    onMouseDown={(e) => { e.preventDefault(); addAssignee(u); }}
                    onMouseEnter={() => setHighlighted(i)}
                    className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                      i === highlighted ? "bg-primary text-white" : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {u.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {filtered.length === 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
              <p className="text-sm text-slate-400">
                {assignees.length === users.length
                  ? "All team members already assigned."
                  : "No match — only team members in Settings can be assigned."}
              </p>
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
