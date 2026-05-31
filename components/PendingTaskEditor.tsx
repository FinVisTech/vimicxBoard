"use client";

import { AlertCircle, CheckCircle2, Plus, Save, Trash2, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type User = { id: string; name: string };

type PendingTaskDraft = {
  id: string;
  title: string;
  description: string | null;
  contextNotes: string | null;
  assigneeName: string | null;
  priority: Priority;
};

type DraftState = {
  title: string;
  description: string;
  contextNotes: string;
  assignees: User[];
  priority: Priority;
};

const priorityOptions: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function splitAssigneeNames(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
}

function getInitialAssignees(task: PendingTaskDraft, users: User[]) {
  const names = splitAssigneeNames(task.assigneeName);
  return users.filter((user) => names.includes(user.name.toLowerCase()));
}

function toDraftState(task: PendingTaskDraft, users: User[]): DraftState {
  return {
    title: task.title,
    description: task.description ?? "",
    contextNotes: task.contextNotes ?? "",
    assignees: getInitialAssignees(task, users),
    priority: task.priority
  };
}

function toPayload(draft: DraftState) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    contextNotes: draft.contextNotes.trim() || null,
    assigneeIds: draft.assignees.map((user) => user.id),
    priority: draft.priority
  };
}

export function PendingTaskEditor({ task, users }: { task: PendingTaskDraft; users: User[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(() => toDraftState(task, users));
  const [savedDraft, setSavedDraft] = useState<DraftState>(() => toDraftState(task, users));
  const [state, setState] = useState<"idle" | "saving" | "approving" | "confirming" | "rejecting">("idle");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const isDirty = JSON.stringify(toPayload(draft)) !== JSON.stringify(toPayload(savedDraft));
  const canSave = draft.title.trim().length >= 2;
  const isBusy = state === "saving" || state === "approving" || state === "rejecting";

  function setField<K extends keyof DraftState>(field: K, value: DraftState[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus(null);
  }

  async function saveDraft(options?: { silent?: boolean }) {
    setError(null);

    if (!canSave) {
      setError("Add a title with at least 2 characters.");
      return false;
    }

    setState("saving");
    try {
      const response = await fetch(`/api/pending-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(draft))
      });
      if (!response.ok) throw new Error(await response.text());
      setSavedDraft(draft);
      if (!options?.silent) setStatus("Draft saved.");
      return true;
    } catch {
      setError("Could not save this draft.");
      return false;
    } finally {
      setState("idle");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await saveDraft();
  }

  async function approveDraft() {
    setState("approving");
    const saved = await saveDraft({ silent: true });
    if (!saved) return;

    setState("approving");
    try {
      const response = await fetch(`/api/pending-tasks/${task.id}/approve`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      const result = (await response.json()) as { task: { id: string } };
      router.push(`/tasks/${result.task.id}`);
      router.refresh();
    } catch {
      setState("idle");
      setError("Could not approve this draft.");
    }
  }

  async function rejectDraft() {
    setState("rejecting");
    setError(null);

    try {
      const response = await fetch(`/api/pending-tasks/${task.id}/reject`, { method: "POST" });
      if (!response.ok) throw new Error(await response.text());
      router.push("/review");
      router.refresh();
    } catch {
      setState("idle");
      setError("Could not reject this draft.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 rounded-lg border border-border bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="grid flex-1 gap-4">
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Title
            <Input
              value={draft.title}
              onChange={(event) => setField("title", event.target.value)}
              disabled={isBusy}
              autoFocus
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Details
            <Textarea
              value={draft.description}
              onChange={(event) => setField("description", event.target.value)}
              disabled={isBusy}
              className="min-h-32"
            />
          </label>
        </div>

        <div className="grid gap-3 lg:w-64">
          <PendingDraftOwnerPicker
            assignees={draft.assignees}
            users={users}
            disabled={isBusy}
            onChange={(nextAssignees) => setField("assignees", nextAssignees)}
          />
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Priority
            <select
              value={draft.priority}
              onChange={(event) => setField("priority", event.target.value as Priority)}
              disabled={isBusy}
              className="h-10 rounded-md border border-border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
            >
              {priorityOptions.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <label className="mt-4 grid gap-1 text-sm font-semibold text-slate-600">
        Meeting context
        <Textarea
          value={draft.contextNotes}
          onChange={(event) => setField("contextNotes", event.target.value)}
          disabled={isBusy}
          className="min-h-36"
        />
      </label>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isBusy || !canSave || !isDirty} className="gap-2">
          <Save className="h-4 w-4" />
          {state === "saving" ? "Saving..." : "Save draft"}
        </Button>
        <Button type="button" onClick={approveDraft} disabled={isBusy || !canSave} className="gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {state === "approving" ? "Approving..." : "Approve to Backlog"}
        </Button>
        {state === "confirming" || state === "rejecting" ? (
          <>
            <Button type="button" onClick={rejectDraft} disabled={isBusy} className="gap-2 bg-red-600">
              <Trash2 className="h-4 w-4" />
              {state === "rejecting" ? "Rejecting..." : "Delete draft"}
            </Button>
            <button
              type="button"
              onClick={() => setState("idle")}
              disabled={isBusy}
              className="h-10 rounded-md border border-border px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setState("confirming")}
            disabled={isBusy}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold text-slate-600 disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            Reject
          </button>
        )}
        {status ? <p className="text-sm font-semibold text-primary">{status}</p> : null}
        {error ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function PendingDraftOwnerPicker({
  assignees,
  users,
  disabled,
  onChange
}: {
  assignees: User[];
  users: User[];
  disabled: boolean;
  onChange: (assignees: User[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const assignedIds = new Set(assignees.map((user) => user.id));
  const filtered = users.filter(
    (user) => !assignedIds.has(user.id) && (query.trim().length === 0 || user.name.toLowerCase().includes(query.toLowerCase()))
  );

  useEffect(() => {
    if (adding) {
      setQuery("");
      setHighlighted(0);
      inputRef.current?.focus();
    }
  }, [adding]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setAdding(false);
      }
    }

    if (adding) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [adding]);

  function addAssignee(user: User) {
    setAdding(false);
    onChange([...assignees, user]);
  }

  function removeAssignee(userId: string) {
    onChange(assignees.filter((user) => user.id !== userId));
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (filtered[highlighted]) addAssignee(filtered[highlighted]);
    } else if (event.key === "Escape") {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Owners</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {assignees.length === 0 && !adding ? (
          <span className="text-sm font-semibold text-slate-400">Unassigned</span>
        ) : null}
        {assignees.map((user) => (
          <span
            key={user.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
          >
            <UserRound className="h-3 w-3 text-slate-400" />
            {user.name}
            <button
              type="button"
              onClick={() => removeAssignee(user.id)}
              disabled={disabled}
              className="ml-0.5 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500 disabled:opacity-50"
              aria-label={`Remove ${user.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            disabled={disabled}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-400 transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add owner
          </button>
        ) : null}
      </div>

      {adding ? (
        <div ref={dropdownRef} className="relative mt-2">
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search team members..."
            disabled={disabled}
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60"
          />
          {filtered.length > 0 ? (
            <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
              {filtered.map((user, index) => (
                <li key={user.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addAssignee(user);
                    }}
                    onMouseEnter={() => setHighlighted(index)}
                    className={`w-full px-4 py-2.5 text-left text-sm font-semibold transition-colors ${
                      index === highlighted ? "bg-primary text-white" : "text-slate-800 hover:bg-slate-50"
                    }`}
                  >
                    {user.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-white px-4 py-3 shadow-lg">
              <p className="text-sm text-slate-400">
                {assignees.length === users.length
                  ? "All team members already assigned."
                  : "No match - only team members in Settings can be assigned."}
              </p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
