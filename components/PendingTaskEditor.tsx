"use client";

import { AlertCircle, CheckCircle2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

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
  assigneeName: string;
  priority: Priority;
};

const priorityOptions: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function toDraftState(task: PendingTaskDraft): DraftState {
  return {
    title: task.title,
    description: task.description ?? "",
    contextNotes: task.contextNotes ?? "",
    assigneeName: task.assigneeName ?? "",
    priority: task.priority
  };
}

function toPayload(draft: DraftState) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    contextNotes: draft.contextNotes.trim() || null,
    assigneeName: draft.assigneeName.trim() || null,
    priority: draft.priority
  };
}

export function PendingTaskEditor({ task }: { task: PendingTaskDraft }) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftState>(() => toDraftState(task));
  const [savedDraft, setSavedDraft] = useState<DraftState>(() => toDraftState(task));
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
          <label className="grid gap-1 text-sm font-semibold text-slate-600">
            Owner
            <Input
              value={draft.assigneeName}
              onChange={(event) => setField("assigneeName", event.target.value)}
              disabled={isBusy}
              placeholder="Unassigned"
            />
          </label>
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
