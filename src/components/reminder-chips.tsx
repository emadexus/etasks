"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface Reminder {
  id: string;
  remindAt: string; // ISO timestamp
  sent: boolean;
}

interface ReminderListProps {
  reminders: Reminder[];
  onAdd: (remindAt: string) => void;
  onRemove: (id: string) => void;
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReminderList({ reminders, onAdd, onRemove }: ReminderListProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newValue, setNewValue] = useState("");

  const pending = reminders.filter(r => !r.sent);
  const sent = reminders.filter(r => r.sent);

  const handleAdd = () => {
    if (!newValue) return;
    // datetime-local input gives "YYYY-MM-DDTHH:mm" in LOCAL time. Convert to ISO UTC.
    const d = new Date(newValue);
    if (!isNaN(d.getTime())) {
      onAdd(d.toISOString());
      setNewValue("");
      setAddOpen(false);
    }
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>{t("reminders")}</div>
        <button
          type="button"
          className="text-[10px] px-2 py-0.5 rounded-md"
          style={{ background: "var(--bg-card)", color: "var(--accent-purple)" }}
          onClick={() => setAddOpen(!addOpen)}
        >
          {addOpen ? "✕" : "+"}
        </button>
      </div>

      {addOpen && (
        <div className="mb-2 flex gap-1">
          <input
            type="datetime-local"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="flex-1 rounded-md px-2 py-1 text-[11px]"
            style={{ background: "var(--bg-card)", color: "var(--text)", border: "1px solid var(--border)" }}
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-md px-2 py-1 text-[11px]"
            style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}
          >
            Add
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {pending.map((r) => (
          <div key={r.id} className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium"
            style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}>
            <span>{formatLocal(r.remindAt)}</span>
            <button type="button" onClick={() => onRemove(r.id)} style={{ opacity: 0.6 }}>✕</button>
          </div>
        ))}
        {sent.map((r) => (
          <div key={r.id} className="rounded-md px-2 py-1 text-[10px]"
            style={{ background: "var(--bg-card)", color: "var(--text-muted)", textDecoration: "line-through" }}>
            {formatLocal(r.remindAt)}
          </div>
        ))}
        {pending.length === 0 && sent.length === 0 && (
          <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>None</div>
        )}
      </div>
    </div>
  );
}

// Backward-compat alias so existing imports don't break during refactor
export { ReminderList as ReminderChips };
