"use client";

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    deadline: string;
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

function relativeDeadline(deadline: string): { text: string; urgent: boolean } {
  const ms = new Date(deadline).getTime() - Date.now();
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
  const deadline = relativeDeadline(task.deadline);

  return (
    <div
      className={`rounded-xl border p-3 transition-all active:scale-[0.98] ${isDone ? "opacity-45" : ""}`}
      style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
      onClick={() => onTap(task.id)}
    >
      <div className="flex items-start gap-2.5">
        <button
          className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-[5px]"
          style={{
            border: isDone ? "none" : `1.5px solid ${isInProgress ? "var(--accent-blue)" : "var(--text-dim)"}`,
            background: isDone ? "var(--text-dim)" : "transparent",
          }}
          onClick={(e) => {
            e.stopPropagation();
            const next = isDone ? "todo" : task.status === "todo" ? "in_progress" : "done";
            onToggleStatus(task.id, next);
          }}
        >
          {isInProgress && <div className="h-2 w-2 rounded-sm" style={{ background: "var(--accent-blue)" }} />}
          {isDone && <span className="text-[10px]" style={{ color: "var(--bg-secondary)" }}>&#10003;</span>}
        </button>
        <div className="min-w-0 flex-1">
          <div className={`text-[13px] font-medium ${isDone ? "line-through" : ""}`}
            style={{ color: isDone ? "var(--text-dim)" : "var(--text-primary)" }}>
            {task.title}
          </div>
          {!isDone && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded px-1.5 py-px text-[10px]" style={{ color: priority.color, background: priority.bg }}>
                {priority.label}
              </span>
              {assignee && (
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {assignee.firstName.toLowerCase()}
                </span>
              )}
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>&middot;</span>
              <span className="text-[10px]" style={{ color: deadline.urgent ? "var(--accent-red)" : "var(--text-muted)" }}>
                {deadline.text}
              </span>
              {commentCount > 0 && (
                <>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>&middot;</span>
                  <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{commentCount}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
