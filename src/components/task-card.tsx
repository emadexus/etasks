"use client";

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

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
  high: { label: "high", color: "var(--accent-orange)", bg: "var(--accent-orange-bg)" },
  medium: { label: "med", color: "var(--accent-yellow)", bg: "var(--accent-yellow-bg)" },
  low: { label: "low", color: "var(--text-dim)", bg: "rgba(255,255,255,0.04)" },
};

function relativeDate(date: string): { text: string; urgent: boolean } {
  const ms = new Date(date).getTime() - Date.now();
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 0) return { text: "overdue", urgent: true };
  if (hours < 1) return { text: "<1h", urgent: true };
  if (hours < 24) return { text: `${hours}h`, urgent: hours <= 2 };
  const days = Math.round(hours / 24);
  return { text: `${days}d`, urgent: false };
}

export function TaskCard({ task, assignee, commentCount, onTap, onToggleStatus }: TaskCardProps) {
  const isDone = task.status === "done";
  const isInProgress = task.status === "in_progress";
  const priority = priorityConfig[task.priority] || priorityConfig.medium;

  const dueInfo = task.dateDue ? relativeDate(task.dateDue) : null;
  const plannedInfo = task.datePlanned ? relativeDate(task.datePlanned) : null;

  return (
    <div
      className={`rounded-xl px-3 py-2.5 transition-all active:scale-[0.98] ${isDone ? "opacity-40" : ""}`}
      style={{ background: "var(--bg-card)" }}
      onClick={() => onTap(task.id)}
    >
      <div className="flex items-start gap-2.5">
        {/* Checkbox */}
        <button
          className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full"
          style={{
            border: isDone ? "none" : `1.5px solid ${isInProgress ? "var(--accent-blue)" : "var(--text-dim)"}`,
            background: isDone ? "var(--accent-green)" : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            const next = isDone ? "todo" : task.status === "todo" ? "in_progress" : "done";
            onToggleStatus(task.id, next);
          }}
        >
          {isInProgress && <div className="h-2 w-2 rounded-full" style={{ background: "var(--accent-blue)" }} />}
          {isDone && <span className="text-[10px] font-bold text-white">✓</span>}
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
              <span
                className="rounded px-1.5 py-px text-[10px] font-medium"
                style={{ color: priority.color, background: priority.bg }}
              >
                {priority.label}
              </span>
              {assignee && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {assignee.firstName.toLowerCase()}
                </span>
              )}
              {dueInfo && (
                <>
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>·</span>
                  <span
                    className="text-[10px]"
                    style={{ color: dueInfo.urgent ? "var(--accent-red)" : "var(--text-muted)" }}
                  >
                    due {dueInfo.text}
                  </span>
                </>
              )}
              {plannedInfo && !dueInfo && (
                <>
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>·</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    planned {plannedInfo.text}
                  </span>
                </>
              )}
              {commentCount > 0 && (
                <>
                  <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>·</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                    💬 {commentCount}
                  </span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
