import { format } from "date-fns";
import { prisma } from "@/lib/prisma";
import TerminalAutoRefresh from "@/components/TerminalAutoRefresh";

export const dynamic = "force-dynamic";

const LEVEL_STYLES: Record<string, string> = {
  INFO:  "text-green-400",
  WARN:  "text-yellow-400",
  ERROR: "text-red-400",
  DEBUG: "text-zinc-500",
};

const CATEGORY_STYLES: Record<string, string> = {
  POLL:    "text-cyan-400",
  API:     "text-violet-400",
  LLM:     "text-yellow-300",
  DB:      "text-emerald-400",
  DISCORD: "text-indigo-400",
  SYSTEM:  "text-zinc-400",
};

function categoryColor(cat: string) {
  return CATEGORY_STYLES[cat] ?? "text-zinc-400";
}

function levelColor(level: string) {
  return LEVEL_STYLES[level] ?? "text-zinc-300";
}

export default async function LogsPage() {
  const entries = await prisma.logEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8">
      <div className="mx-auto max-w-6xl">

        {/* Header */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-xs text-zinc-500 uppercase tracking-widest">vimicx board</p>
            <h1 className="font-mono text-xl font-bold text-zinc-100">debug console</h1>
          </div>
          <TerminalAutoRefresh intervalMs={10000} />
        </div>

        {/* Legend */}
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
          {Object.entries(LEVEL_STYLES).map(([level, cls]) => (
            <span key={level} className={cls}>{level}</span>
          ))}
          <span className="text-zinc-600">·</span>
          {Object.entries(CATEGORY_STYLES).map(([cat, cls]) => (
            <span key={cat} className={cls}>[{cat}]</span>
          ))}
        </div>

        {/* Terminal window */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2">
            <span className="h-3 w-3 rounded-full bg-red-500/70" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
            <span className="h-3 w-3 rounded-full bg-green-500/70" />
            <span className="ml-2 font-mono text-xs text-zinc-500">
              notesbot pipeline · last 100 entries
            </span>
          </div>

          <div className="overflow-x-auto">
            {entries.length === 0 ? (
              <div className="px-5 py-8 font-mono text-sm text-zinc-600">
                $ waiting for first poll... (bot fires every 5 minutes after startup)
              </div>
            ) : (
              <table className="w-full font-mono text-xs">
                <tbody>
                  {entries.map((entry, i) => (
                    <tr
                      key={entry.id}
                      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                        entry.level === "ERROR" ? "bg-red-950/20" :
                        entry.level === "WARN"  ? "bg-yellow-950/10" : ""
                      }`}
                    >
                      {/* Line number */}
                      <td className="select-none px-3 py-1.5 text-right text-zinc-700 w-8">
                        {entries.length - i}
                      </td>

                      {/* Timestamp */}
                      <td className="px-3 py-1.5 text-zinc-600 whitespace-nowrap w-28">
                        {format(entry.createdAt, "HH:mm:ss.SSS")}
                      </td>

                      {/* Category */}
                      <td className={`px-3 py-1.5 whitespace-nowrap w-20 font-semibold ${categoryColor(entry.category)}`}>
                        [{entry.category}]
                      </td>

                      {/* Level */}
                      <td className={`px-3 py-1.5 whitespace-nowrap w-14 ${levelColor(entry.level)}`}>
                        {entry.level}
                      </td>

                      {/* Message */}
                      <td className="px-3 py-1.5 text-zinc-300 break-all">
                        {entry.message}
                        {entry.meta && (
                          <span className="ml-2 text-zinc-600">{entry.meta}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <p className="mt-3 font-mono text-xs text-zinc-700">
          showing newest first · entries older than the last 100 are not displayed
        </p>
      </div>
    </main>
  );
}
