"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface Comment {
  comment: { id: string; text: string; createdAt: string };
  author: { firstName: string };
}

interface CommentThreadProps {
  comments: Comment[];
  onAdd: (text: string) => Promise<void>;
}

function timeAgo(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return t("now");
  if (mins < 60) return `${mins}${t("mAgo")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}${t("hAgo")}`;
  const days = Math.floor(hours / 24);
  return `${days}${t("dAgo")}`;
}

export function CommentThread({ comments, onAdd }: CommentThreadProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const text = value.trim();
    if (!text || loading) return;
    setLoading(true);
    try { await onAdd(text); setValue(""); } finally { setLoading(false); }
  };

  return (
    <div>
      <div className="mb-2 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("comments")}</div>
      {comments.length === 0 && (
        <p className="mb-3 text-[11px]" style={{ color: "var(--text-dim)" }}>{t("noCommentsYet")}</p>
      )}
      <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
        {comments.map((c) => (
          <div key={c.comment.id} className="rounded-lg p-2.5" style={{ background: "var(--bg-card)" }}>
            <div className="text-[11px]">
              <span className="font-medium">{c.author.firstName}</span>
              <span className="ml-1.5" style={{ color: "var(--text-dim)", fontSize: "10px" }}>
                {timeAgo(c.comment.createdAt)}
              </span>
            </div>
            <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {c.comment.text}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="flex-1 rounded-lg bg-transparent px-2.5 py-2 text-[12px] outline-none"
          style={{ background: "var(--bg-card)", color: "var(--text-primary)" }}
          placeholder={t("addComment")} value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          disabled={loading} />
        <button className="press-scale flex h-10 w-10 items-center justify-center rounded-xl text-[14px] text-white"
          style={{ background: "var(--accent-purple)" }} onClick={handleSend} disabled={loading}>
          ↑
        </button>
      </div>
    </div>
  );
}
