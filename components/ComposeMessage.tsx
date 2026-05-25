"use client";

import { useState } from "react";

type Props = {
  defaultChannelId: string;
};

type Stage = "compose" | "preview" | "sending" | "sent" | "error";

export function ComposeMessage({ defaultChannelId }: Props) {
  const [channelId, setChannelId] = useState(defaultChannelId);
  const [content, setContent] = useState("");
  const [stage, setStage] = useState<Stage>("compose");
  const [errorMsg, setErrorMsg] = useState("");

  const remaining = 2000 - content.length;

  async function handleSend() {
    setStage("sending");
    setErrorMsg("");
    const res = await fetch("/api/discord/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId, content })
    });

    if (res.ok) {
      setStage("sent");
      setContent("");
    } else {
      const json = await res.json().catch(() => ({}));
      setErrorMsg(json.error ?? "Something went wrong");
      setStage("error");
    }
  }

  if (stage === "sent") {
    return (
      <div className="rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
        Message sent to Discord.{" "}
        <button
          onClick={() => setStage("compose")}
          className="underline font-semibold"
        >
          Send another
        </button>
      </div>
    );
  }

  if (stage === "preview") {
    return (
      <div className="grid gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
            Preview — this is exactly what Discord will receive
          </p>
          <div className="rounded-md bg-[#313338] text-[#dbdee1] font-mono text-sm whitespace-pre-wrap p-4 leading-relaxed">
            {content}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Sending to channel <span className="font-mono font-semibold">{channelId}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSend}
            className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
          >
            Confirm &amp; Send
          </button>
          <button
            onClick={() => setStage("compose")}
            className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-slate-600"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="channel-id">
          Discord Channel ID
        </label>
        <input
          id="channel-id"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="e.g. 1234567890123456789"
          className="rounded-md border border-border px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-primary"
        />
        <p className="text-xs text-slate-400">
          Right-click any channel in Discord → Copy Channel ID (requires Developer Mode).
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="message-body">
          Message
        </label>
        <textarea
          id="message-body"
          rows={8}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message here. Discord markdown works: **bold**, *italic*, `code`, > blockquote"
          className="rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-y font-mono"
        />
        <p className={`text-xs text-right ${remaining < 100 ? "text-amber-600 font-semibold" : "text-slate-400"}`}>
          {remaining} characters remaining
        </p>
      </div>

      {stage === "error" && (
        <p className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{errorMsg}</p>
      )}

      <button
        onClick={() => setStage("preview")}
        disabled={content.trim().length === 0 || channelId.trim().length === 0 || remaining < 0}
        className="justify-self-start rounded-md bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Preview before sending →
      </button>
    </div>
  );
}
