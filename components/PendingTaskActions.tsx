"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { taskId: string };

export default function PendingTaskActions({ taskId }: Props) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "approving" | "confirming" | "rejecting" | "done">("idle");

  async function handleApprove() {
    setState("approving");
    await fetch(`/api/pending-tasks/${taskId}/approve`, { method: "POST" });
    setState("done");
    router.refresh();
  }

  async function handleReject() {
    setState("rejecting");
    await fetch(`/api/pending-tasks/${taskId}/reject`, { method: "POST" });
    setState("done");
    router.refresh();
  }

  if (state === "done") return null;

  return (
    <div className="flex shrink-0 gap-2">
      {state === "confirming" ? (
        <>
          <span className="flex items-center text-xs text-slate-500">Delete this task?</span>
          <button
            onClick={handleReject}
            className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Yes, delete
          </button>
          <button
            onClick={() => setState("idle")}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-slate-600"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            onClick={handleApprove}
            disabled={state !== "idle"}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            {state === "approving" ? "Adding…" : "Approve → Backlog"}
          </button>
          <button
            onClick={() => setState("confirming")}
            disabled={state !== "idle"}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-50"
          >
            Reject
          </button>
        </>
      )}
    </div>
  );
}
