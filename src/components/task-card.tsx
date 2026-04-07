"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dateDue: string | null;
    datePlanned: string | null;
    assigneeId: string | null;
  };
  assignee: {
    firstName: string;
    username: string | null;
  } | null;
  commentCount: number;
  onTap: (id: string) => void;
  onToggleStatus: (id: string, newStatus: string) => void;
}

const priorityStripe: Record<string, string> = {
  high: "var(--accent-orange)",
  medium: "var(--accent-yellow)",
  low: "transparent",
};

function getPriorityConfig(priority: string) {
  switch (priority) {
    case "high": return { label: t("priorityHigh"), color: "var(--accent-orange)", bg: "var(--accent-orange-bg)" };
    case "medium": return { label: t("priorityMed"), color: "var(--accent-yellow)", bg: "var(--accent-yellow-bg)" };
    default: return { label: t("priorityLow"), color: "var(--text-dim)", bg: "rgba(255,255,255,0.04)" };
  }
}

function relativeDate(date: string): { text: string; urgent: boolean } {
  const ms = new Date(date).getTime() - Date.now();
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 0) return { text: t("overdue"), urgent: true };
  if (hours < 1) return { text: t("lessThan1h"), urgent: true };
  if (hours < 24) return { text: `${hours}${t("hAgo").charAt(0)}`, urgent: hours <= 2 };
  const days = Math.round(hours / 24);
  return { text: `${days}${t("dAgo").charAt(0)}`, urgent: false };
}

export function TaskCard({ task, assignee, commentCount, onTap, onToggleStatus }: TaskCardProps) {
  const [animating, setAnimating] = useState(false);
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";
  const priority = getPriorityConfig(task.priority);

  const dueInfo = task.dateDue ? relativeDate(task.dateDue) : null;
  const plannedInfo = task.datePlanned ? relativeDate(task.datePlanned) : null;
  const stripe = priorityStripe[task.priority] || "transparent";
  const isOverdue = dueInfo?.urgent && task.status !== "done";

  return (
    <div
      className={`flex overflow-hidden rounded-xl transition-all active:scale-[0.98] ${isDone ? "opacity-40" : ""}`}
      style={{
        background: isOverdue ? "rgba(255, 69, 58, 0.06)" : "var(--bg-card)",
      }}
      onClick={() => onTap(task.id)}
    >
      {/* Priority stripe */}
      <div className="w-[3px] flex-shrink-0" style={{ background: isDone ? "transparent" : stripe }} />

      <div className="flex flex-1 items-start gap-2.5 px-3 py-2.5">
        {/* Checkbox — 24px, with bounce animation */}
        <button
          className={`mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-all ${animating ? "animate-check" : ""}`}
          style={{
            border: isDone ? "none" : `2px solid ${isInProgress ? "var(--accent-blue)" : "var(--text-dim)"}`,
            background: isDone ? "var(--accent-green)" : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setAnimating(true);
            setTimeout(() => setAnimating(false), 300);
            const next = isDone ? "todo" : task.status === "todo" ? "in_progress" : "done";
            onToggleStatus(task.id, next);
          }}
        >
          {isInProgress && (
            <div className="h-3 w-3 rounded-full" style={{ background: "var(--accent-blue)", opacity: 0.7 }} />
          )}
          {isDone && <span className="text-[11px] font-bold text-white">✓</span>}
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div
            className={`text-[13px] font-medium leading-snug ${isDone ? "line-through" : ""}`}
            style={{ color: isDone ? "var(--text-dim)" : "var(--text-primary)" }}
          >
            {task.title}
          </div>
          {!isDone && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {assignee && (
                <div className="flex items-center gap-1">
                  <div
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold"
                    style={{ background: "var(--accent-blue-bg)", color: "var(--accent-blue)" }}
                  >
                    {assignee.firstName[0].toUpperCase()}
                  </div>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    {assignee.firstName.toLowerCase()}
                  </span>
                </div>
              )}
              {dueInfo && (
                <span
                  className="rounded px-1.5 py-px text-[10px] font-medium"
                  style={{
                    color: dueInfo.urgent ? "#fff" : "var(--text-muted)",
                    background: dueInfo.urgent ? "var(--accent-red)" : "transparent",
                  }}
                >
                  {dueInfo.text}
                </span>
              )}
              {plannedInfo && !dueInfo && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {t("plannedPrefix")} {plannedInfo.text}
                </span>
              )}
              {commentCount > 0 && (
                <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                  💬 {commentCount}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
