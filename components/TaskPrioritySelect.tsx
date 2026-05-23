"use client";

import { useState } from "react";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const priorityOptions: Priority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

const priorityClassName = {
  LOW: "border-slate-200 bg-slate-100 text-slate-700",
  MEDIUM: "border-sky-200 bg-sky-100 text-sky-800",
  HIGH: "border-amber-200 bg-amber-100 text-amber-800",
  URGENT: "border-red-200 bg-red-100 text-red-800"
};

export function TaskPrioritySelect({ taskId, initialPriority }: { taskId: string; initialPriority: Priority }) {
  const [priority, setPriority] = useState(initialPriority);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updatePriority(nextPriority: Priority) {
    const previousPriority = priority;
    setPriority(nextPriority);
    setIsSaving(true);
    setError(null);

    const response = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priority: nextPriority, source: "WEB" })
    });

    setIsSaving(false);

    if (!response.ok) {
      setPriority(previousPriority);
      setError("Priority could not be saved.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="task-priority">
        Priority
      </label>
      <select
        id="task-priority"
        value={priority}
        onChange={(event) => updatePriority(event.target.value as Priority)}
        disabled={isSaving}
        className={`rounded-full border px-3 py-1 text-sm font-semibold outline-none transition-colors ${priorityClassName[priority]}`}
      >
        {priorityOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
    </div>
  );
}
