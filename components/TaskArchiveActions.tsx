"use client";

import { Archive, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function TaskArchiveActions({ taskId, isArchived }: { taskId: string; isArchived: boolean }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function updateArchiveState(nextArchived: boolean) {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: nextArchived, source: "WEB" })
      });
      if (!response.ok) throw new Error("Archive update failed");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  if (isArchived) {
    return (
      <Button type="button" onClick={() => updateArchiveState(false)} disabled={isSaving} className="h-10 w-full justify-center gap-2 rounded-md bg-slate-900 px-3">
        <RotateCcw className="h-4 w-4" />
        Restore
      </Button>
    );
  }

  return (
    <Button type="button" onClick={() => updateArchiveState(true)} disabled={isSaving} className="h-10 w-full justify-center gap-2 rounded-md bg-slate-900 px-3">
      <Archive className="h-4 w-4" />
      Archive
    </Button>
  );
}
