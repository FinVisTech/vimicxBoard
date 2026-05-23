"use client";

import { useEffect, useState } from "react";

type Comment = {
  id: string;
  body: string;
  source: "WEB" | "DISCORD" | "SLACK" | "AGENT";
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string } | null;
};

export function TaskComments({ taskId, initialComments }: { taskId: string; initialComments: Comment[] }) {
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await fetch(`/api/tasks/${taskId}`, { cache: "no-store" });
      if (!response.ok) return;
      const task = (await response.json()) as { comments: Comment[] };
      setComments(task.comments);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [taskId]);

  async function addComment() {
    const body = draft.trim();
    if (!body || isSaving) return;

    setIsSaving(true);
    setError(null);
    const response = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, source: "WEB" })
    });
    setIsSaving(false);

    if (!response.ok) {
      setError("Comment could not be saved.");
      return;
    }

    const comment = (await response.json()) as Comment;
    setComments((current) => [comment, ...current]);
    setDraft("");
  }

  async function saveEdit(commentId: string) {
    const body = editingBody.trim();
    if (!body || isSaving) return;

    setIsSaving(true);
    setError(null);
    const response = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    setIsSaving(false);

    if (!response.ok) {
      setError("Comment could not be updated.");
      return;
    }

    const comment = (await response.json()) as Comment;
    setComments((current) => current.map((item) => (item.id === comment.id ? comment : item)));
    setEditingId(null);
    setEditingBody("");
  }

  function startEditing(comment: Comment) {
    setEditingId(comment.id);
    setEditingBody(comment.body);
  }

  return (
    <section className="mt-6 rounded-lg border border-border bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Comments</h2>
        <span className="text-xs font-semibold text-slate-500">Updates live</span>
      </div>

      <div className="mt-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-28 w-full resize-y rounded-md border border-border bg-white p-3 text-sm outline-none focus:border-primary"
          placeholder="Add a comment"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-red-600">{error}</p>
          <button
            type="button"
            onClick={addComment}
            disabled={isSaving || draft.trim().length === 0}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add Comment
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
        {comments.map((comment) => (
          <div key={comment.id} className="rounded-md bg-slate-50 p-3 text-sm">
            {editingId === comment.id ? (
              <>
                <textarea
                  value={editingBody}
                  onChange={(event) => setEditingBody(event.target.value)}
                  className="min-h-24 w-full resize-y rounded-md border border-border bg-white p-3 text-sm outline-none focus:border-primary"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setEditingBody("");
                    }}
                    className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(comment.id)}
                    disabled={isSaving || editingBody.trim().length === 0}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="whitespace-pre-wrap leading-6">{comment.body}</p>
                <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{comment.user?.name ?? comment.source}</span>
                  <button type="button" onClick={() => startEditing(comment)} className="font-semibold text-primary">
                    Edit
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
