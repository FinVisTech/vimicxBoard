"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ArchiveRestoreButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function restoreTask() {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: false, source: "WEB" })
      });
      if (!response.ok) throw new Error("Restore failed");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Button type="button" onClick={restoreTask} disabled={isSaving} className="h-9 gap-2 bg-slate-900 px-3">
      <RotateCcw className="h-4 w-4" />
      Restore
    </Button>
  );
}
