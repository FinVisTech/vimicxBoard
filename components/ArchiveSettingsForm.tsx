"use client";

import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ArchiveSettingsForm({ initialDays }: { initialDays: number }) {
  const router = useRouter();
  const [days, setDays] = useState(String(initialDays));
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [isSaving, setIsSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setStatus("idle");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveDoneAfterDays: Number(days) })
      });
      if (!response.ok) throw new Error("Settings update failed");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
      <label className="grid gap-1 text-sm font-semibold text-slate-600" htmlFor="archive-days">
        Auto-archive Done tasks after
        <Input
          id="archive-days"
          type="number"
          min={0}
          max={365}
          value={days}
          onChange={(event) => setDays(event.target.value)}
          className="w-36"
        />
      </label>
      <Button type="submit" disabled={isSaving} className="gap-2">
        <Save className="h-4 w-4" />
        Save
      </Button>
      {status === "saved" ? <p className="text-sm font-semibold text-emerald-700">Saved</p> : null}
      {status === "error" ? <p className="text-sm font-semibold text-red-700">Could not save</p> : null}
    </form>
  );
}
