"use client";

import { useEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import { format, parseISO } from "date-fns";
import "react-day-picker/style.css";

export function TaskDueDatePicker({
  taskId,
  initialDueDate
}: {
  taskId: string;
  initialDueDate: string | null;
}) {
  const [dueDate, setDueDate] = useState<Date | undefined>(
    initialDueDate ? parseISO(initialDueDate) : undefined
  );
  const [open, setOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function save(date: Date | undefined) {
    setIsSaving(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueDate: date ? date.toISOString() : null, source: "WEB" })
    });
    setIsSaving(false);
    if (!res.ok) setError("Could not save date.");
  }

  function handleSelect(date: Date | undefined) {
    setDueDate(date);
    setOpen(false);
    save(date);
  }

  async function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setDueDate(undefined);
    setOpen(false);
    await save(undefined);
  }

  const label = dueDate ? format(dueDate, "MMM d, yyyy") : "Set due date";
  const isOverdue = dueDate && dueDate < new Date() && !isSaving;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Due Date</span>

      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={isSaving}
          className={`rounded-full border px-3 py-1 text-sm font-semibold outline-none transition-colors disabled:opacity-50
            ${dueDate
              ? isOverdue
                ? "border-red-200 bg-red-100 text-red-700 hover:bg-red-200"
                : "border-emerald-200 bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
              : "border-slate-200 bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
        >
          {isSaving ? "Saving…" : label}
        </button>

        {open && (
          <div className="absolute right-0 z-50 mt-2 rounded-xl border border-border bg-white shadow-xl">
            <DayPicker
              mode="single"
              selected={dueDate}
              onSelect={handleSelect}
              defaultMonth={dueDate ?? new Date()}
              classNames={{
                today: "font-bold text-primary",
                selected: "bg-primary text-white rounded-full",
                day_button: "rounded-full hover:bg-slate-100 transition-colors"
              }}
            />
            {dueDate && (
              <div className="border-t border-border px-4 pb-3">
                <button
                  onClick={handleClear}
                  className="text-xs font-semibold text-slate-400 hover:text-red-500"
                >
                  Clear due date
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}
