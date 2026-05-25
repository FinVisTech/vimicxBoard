"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export default function TerminalAutoRefresh({ intervalMs = 10000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [countdown, setCountdown] = useState(Math.floor(intervalMs / 1000));

  const refresh = useCallback(() => {
    router.refresh();
    setLastRefresh(new Date());
    setCountdown(Math.floor(intervalMs / 1000));
  }, [router, intervalMs]);

  useEffect(() => {
    const refreshTimer = setInterval(refresh, intervalMs);
    const countdownTimer = setInterval(() => {
      setCountdown((prev) => (prev > 1 ? prev - 1 : Math.floor(intervalMs / 1000)));
    }, 1000);
    return () => { clearInterval(refreshTimer); clearInterval(countdownTimer); };
  }, [refresh, intervalMs]);

  return (
    <div className="flex items-center gap-4 font-mono text-xs text-zinc-500">
      <span>
        last refresh <span className="text-zinc-300">{lastRefresh.toLocaleTimeString()}</span>
      </span>
      <span>
        next in <span className="text-zinc-300">{countdown}s</span>
      </span>
      <button
        onClick={refresh}
        className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
      >
        refresh now
      </button>
    </div>
  );
}
