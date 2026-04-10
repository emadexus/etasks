"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { openBotDeepLink } from "@/lib/telegram-links";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dateDue: string | null;
    datePlanned: string | null;
    assigneeId: string | null;
    tags: string | null;
    checklist: string | null;
    boardId: string | null;
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

// Particle burst colors
const BURST_COLORS = ["#8B5CF6", "#34d399", "#6366f1", "#fb923c", "#facc15"];

function CompletionBurst() {
  const particles = Array.from({ length: 8 }).map((_, i) => {
    const angle = (i / 8) * 360 + Math.random() * 20;
    const distance = 18 + Math.random() * 14;
    const dx = Math.cos((angle * Math.PI) / 180) * distance;
    const dy = Math.sin((angle * Math.PI) / 180) * distance;
    const color = BURST_COLORS[i % BURST_COLORS.length];
    const delay = Math.random() * 60;
    return (
      <div
        key={i}
        className="particle"
        style={{
          "--dx": `${dx}px`,
          "--dy": `${dy}px`,
          background: color,
          animationDelay: `${delay}ms`,
        } as React.CSSProperties}
      />
    );
  });
  return <div className="completion-burst">{particles}</div>;
}


export function TaskCard({ task, assignee, commentCount, onTap, onToggleStatus }: TaskCardProps) {
  const [animating, setAnimating] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  const [completing, setCompleting] = useState(false);
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";
  const priority = getPriorityConfig(task.priority);

  const dueInfo = task.dateDue ? relativeDate(task.dateDue) : null;
  const plannedInfo = task.datePlanned ? relativeDate(task.datePlanned) : null;
  const stripe = priorityStripe[task.priority] || "transparent";
  const isOverdue = dueInfo?.urgent && task.status !== "done";

  const cardBg = isDone
    ? undefined
    : isOverdue
      ? "rgba(248, 113, 113, 0.08)"
      : task.priority === "high"
        ? "rgba(251, 146, 60, 0.05)"
        : task.priority === "medium"
          ? "rgba(250, 204, 21, 0.03)"
          : undefined;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = isDone ? "todo" : (task.status === "todo" ? "in_progress" : "done");

    if (next === "done") {
      // Completion celebration
      setShowBurst(true);
      setAnimating(true);
      setTimeout(() => {
        setCompleting(true);
        onToggleStatus(task.id, next);
      }, 200);
      setTimeout(() => {
        setShowBurst(false);
        setAnimating(false);
      }, 600);
    } else {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 300);
      onToggleStatus(task.id, next);
    }
  };

  const handleForward = (e: React.MouseEvent) => {
    e.stopPropagation();
    openBotDeepLink(task.id);
  };

  return (
    <div className={completing ? "task-completing" : ""}>
      <div
        className={`card-elevated glass press-scale relative flex overflow-hidden rounded-xl ${isDone ? "opacity-40" : ""}`}
        style={{ background: cardBg }}
        onClick={() => onTap(task.id)}
      >
        {/* Priority stripe */}
        <div className="w-[3px] flex-shrink-0" style={{ background: isDone ? "transparent" : stripe }} />

        <div className="flex flex-1 items-start gap-2.5 px-3 py-2.5">
          {/* Checkbox */}
          <button
            className={`mt-px flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-all ${animating ? "animate-check" : ""}`}
            style={{
              border: isDone ? "none" : `2px solid ${isInProgress ? "var(--accent-blue)" : "var(--text-dim)"}`,
              background: isDone ? "var(--accent-green)" : "transparent",
            }}
            onClick={handleToggle}
          >
            {isInProgress && (
              <div className="h-3 w-3 rounded-full" style={{ background: "var(--accent-blue)", opacity: 0.7 }} />
            )}
            {isDone && <span className="text-[11px] font-bold text-white">✓</span>}
          </button>

          {/* Burst particles */}
          {showBurst && <CompletionBurst />}

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
                {(() => {
                  const cl: { done: boolean }[] = task.checklist ? (typeof task.checklist === "string" ? JSON.parse(task.checklist) : task.checklist) : [];
                  if (cl.length === 0) return null;
                  const done = cl.filter(c => c.done).length;
                  return (
                    <span className="text-[10px]" style={{ color: done === cl.length ? "var(--accent-green)" : "var(--text-dim)" }}>
                      ☑ {done}/{cl.length}
                    </span>
                  );
                })()}
                {(() => {
                  const tags: string[] = task.tags ? (typeof task.tags === "string" ? JSON.parse(task.tags) : task.tags) : [];
                  return tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded px-1.5 py-px text-[9px] font-medium"
                      style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}
                    >
                      {tag}
                    </span>
                  ));
                })()}
              </div>
            )}
          </div>

          {!isDone && (
            <button
              className="ml-auto flex h-6 w-6 flex-shrink-0 items-center justify-center self-center rounded-md opacity-40 transition-opacity active:opacity-100"
              onClick={handleForward}
              title={t("forwardToBot")}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2L7 9" />
                <path d="M14 2L9.5 14L7 9L2 6.5L14 2Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
