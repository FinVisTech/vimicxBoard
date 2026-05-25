"use client";

import { formatDistanceToNow } from "date-fns";
import { Search } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { ArchiveRestoreButton } from "@/components/ArchiveRestoreButton";
import { Input } from "@/components/ui/input";
import { buildArchiveSearchResults, type ArchiveSearchResult, type ArchiveSearchTask, splitHighlightedText } from "@/lib/archiveSearch";

export function ArchiveSearchClient({
  initialQuery,
  archiveItems
}: {
  initialQuery: string;
  archiveItems: ArchiveSearchTask[];
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => buildArchiveSearchResults(archiveItems, deferredQuery), [archiveItems, deferredQuery]);
  const isSearching = query !== deferredQuery;

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      const trimmedQuery = query.trim();
      if (trimmedQuery) params.set("q", trimmedQuery);

      const nextUrl = params.toString() ? `/archive?${params.toString()}` : "/archive";
      window.history.replaceState(null, "", nextUrl);
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const isFiltered = deferredQuery.trim().length > 0;

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">Archive</p>
          <h1 className="text-3xl font-bold">Archived Tiles</h1>
        </div>
        <label className="relative flex w-full sm:w-96" htmlFor="archive-search">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="archive-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search archived tiles, people, comments"
            className="h-11 min-w-0 flex-1 pl-9"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="mt-3 flex min-h-6 items-center text-sm text-slate-500">
        {isSearching ? (
          <span>Searching archive...</span>
        ) : isFiltered ? (
          <span>
            {results.length} {results.length === 1 ? "match" : "matches"}
          </span>
        ) : (
          <span>{results.length} archived tiles</span>
        )}
      </div>

      <div className="mt-3 grid gap-3">
        {results.length === 0 ? (
          <div className="rounded-lg border border-border bg-white p-6 text-sm text-slate-600">
            {isFiltered ? "No archived tiles match that search." : "No archived tiles found."}
          </div>
        ) : (
          results.map((task) => <ArchiveCard key={task.id} task={task} query={deferredQuery} />)
        )}
      </div>
    </>
  );
}

function ArchiveCard({ task, query }: { task: ArchiveSearchResult; query: string }) {
  return (
    <article className="rounded-lg border border-border bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            <span>{task.columnName}</span>
            <span>
              <HighlightedText text={task.assigneeName ?? "Unassigned"} query={query} />
            </span>
            <span>{task.archivedAt ? `Archived ${formatDistanceToNow(new Date(task.archivedAt), { addSuffix: true })}` : "Archived"}</span>
          </div>
          <Link href={`/tasks/${task.id}`} className="mt-1 block text-lg font-semibold text-slate-950">
            <HighlightedText text={task.title} query={query} />
          </Link>
          {task.description ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
              <HighlightedText text={task.description} query={query} />
            </p>
          ) : null}
          {task.latestNote ? (
            <p className="mt-2 text-sm text-slate-500">
              Latest note: <HighlightedText text={task.latestNote} query={query} />
            </p>
          ) : null}
          {task.commentSnippets.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {task.commentSnippets.map((comment) => (
                <p key={comment.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-600">
                  Comment match: <HighlightedText text={comment.body} query={query} />
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <ArchiveRestoreButton taskId={task.id} />
      </div>
    </article>
  );
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  return (
    <>
      {splitHighlightedText(text, query).map((chunk, index) =>
        chunk.isMatch ? (
          <mark key={`${chunk.text}-${index}`} className="rounded-sm bg-amber-100 px-0.5 text-inherit">
            {chunk.text}
          </mark>
        ) : (
          <span key={`${chunk.text}-${index}`}>{chunk.text}</span>
        )
      )}
    </>
  );
}
