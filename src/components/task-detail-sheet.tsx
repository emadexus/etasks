"use client";

import { useState, useEffect, useCallback } from "react";
import { useTaskDetail, useComments, useTaskActions, useMembers } from "@/hooks/use-board";
import { CommentThread } from "./comment-thread";
import { ReminderChips } from "./reminder-chips";

interface TaskDetailSheetProps {
  taskId: string | null;
  chatId: string;
  onClose: () => void;
}

const statusMap: Record<string, { label: string; color: string; next: string }> = {
  todo: { label: "To do", color: "var(--text-muted)", next: "in_progress" },
  in_progress: { label: "In progress", color: "var(--accent-blue)", next: "done" },
  done: { label: "Done", color: "#22c55e", next: "todo" },
};

const priorityMap: Record<string, { label: string; color: string; next: string }> = {
  low: { label: "Low", color: "var(--text-dim)", next: "medium" },
  medium: { label: "Medium", color: "var(--accent-yellow)", next: "high" },
  high: { label: "High", color: "var(--accent-orange)", next: "low" },
};

// Inline tappable label that cycles through options
function CycleLabel({ value, map, onCycle }: {
  value: string;
  map: Record<string, { label: string; color: string; next: string }>;
  onCycle: (next: string) => void;
}) {
  const item = map[value] || Object.values(map)[0];
  return (
    <span
      className="cursor-pointer rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors active:opacity-70"
      style={{ color: item.color, background: `${item.color}15` }}
      onClick={(e) => { e.stopPropagation(); onCycle(item.next); }}
    >
      {item.label}
    </span>
  );
}

// Assignee picker — shows as inline text, tappable to show member list
function AssigneePicker({ assignee, members, onChange }: {
  assignee: any;
  members: any[];
  onChange: (memberId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        className="cursor-pointer text-[11px] transition-colors active:opacity-70"
        style={{ color: assignee ? "var(--accent-blue)" : "var(--text-dim)" }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {assignee ? `@${assignee.username || assignee.firstName}` : "unassigned"}
      </span>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[60] mt-1 min-w-[140px] rounded-lg border p-1 shadow-lg"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border-card)" }}>
            <button
              className="block w-full rounded px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/5"
              style={{ color: "var(--text-muted)" }}
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            >
              Unassign
            </button>
            {members.map((m: any) => (
              <button key={m.id}
                className="block w-full rounded px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/5"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => { e.stopPropagation(); onChange(m.id); setOpen(false); }}
              >
                {m.firstName} {m.username ? `@${m.username}` : ""}
              </button>
            ))}
            {members.length === 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-dim)" }}>
                No members found
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

export function TaskDetailSheet({ taskId, chatId, onClose }: TaskDetailSheetProps) {
  const { data: taskData, mutate: mutateTask } = useTaskDetail(taskId);
  const { data: commentsData, mutate: mutateComments } = useComments(taskId);
  const { data: membersData } = useMembers(chatId);
  const { updateTask, addComment } = useTaskActions(chatId);

  // Local optimistic state
  const [localTask, setLocalTask] = useState<any>(null);
  const [localReminders, setLocalReminders] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [saving, setSaving] = useState(false);

  // Sync from server data — but ONLY when no updates are in flight
  useEffect(() => {
    if (taskData?.task && pendingUpdates === 0) {
      setLocalTask(taskData.task);
      setTitle(taskData.task.title);
      setDescription(taskData.task.description || "");
      const offsets = (taskData.reminders || [])
        .filter((r: any) => !r.sent)
        .map((r: any) => r.offsetLabel);
      setLocalReminders(offsets);
      setSaving(false);
    }
  }, [taskData, pendingUpdates]);

  const handleUpdate = useCallback(async (field: string, value: any) => {
    // Optimistic: update UI instantly
    setLocalTask((prev: any) => prev ? { ...prev, [field]: value } : prev);
    setSaving(true);
    setPendingUpdates(n => n + 1);

    // API in background
    updateTask(localTask?.id || taskId!, { [field]: value })
      .then(() => {
        setPendingUpdates(n => n - 1);
        mutateTask(); // refetch server state — will sync once pending hits 0
      })
      .catch((e) => {
        console.error(e);
        setPendingUpdates(n => n - 1);
        setSaving(false);
      });
  }, [localTask, taskId, updateTask, mutateTask]);

  if (!taskId || !localTask) return null;

  const task = localTask;
  const assignee = taskData?.assignee;
  const deadlineDate = new Date(task.deadline);
  const isOverdue = deadlineDate.getTime() < Date.now();

  const deadlineDisplay = deadlineDate.toLocaleDateString("en-US", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const toLocalInput = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl border-t"
        style={{ background: "var(--bg-secondary)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Handle + saving indicator */}
        <div className="flex-shrink-0 px-4 pt-3">
          <div className="mx-auto mb-1 h-1 w-9 rounded-full" style={{ background: "var(--text-dim)" }} />
          <div className="h-4 text-center text-[10px]" style={{ color: "var(--text-dim)" }}>
            {saving ? "Saving..." : ""}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Title */}
          <input className="mb-1 w-full bg-transparent text-[16px] font-semibold outline-none"
            value={title} onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && handleUpdate("title", title)} />

          {/* Description */}
          <textarea className="mb-3 w-full resize-none bg-transparent text-[12px] outline-none"
            style={{ color: "var(--text-muted)" }} placeholder="Add description..." rows={2}
            value={description} onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description || "") && handleUpdate("description", description)} />

          {/* Inline meta row — concise, tappable */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
            <CycleLabel value={task.status} map={statusMap} onCycle={(next) => handleUpdate("status", next)} />
            <span>&middot;</span>
            <CycleLabel value={task.priority} map={priorityMap} onCycle={(next) => handleUpdate("priority", next)} />
            <span>&middot;</span>
            <AssigneePicker
              assignee={assignee}
              members={membersData || []}
              onChange={(id) => handleUpdate("assigneeId", id)}
            />
            <span>&middot;</span>
            {/* Due date — native input, styled inline */}
            <input
              type="datetime-local"
              className="cursor-pointer rounded bg-transparent px-1 py-0.5 text-[11px] outline-none"
              style={{
                color: isOverdue ? "var(--accent-red)" : "var(--text-primary)",
                colorScheme: "dark",
                WebkitAppearance: "none",
              }}
              value={toLocalInput(deadlineDate)}
              onChange={(e) => {
                if (e.target.value) handleUpdate("deadline", new Date(e.target.value).toISOString());
              }}
            />
          </div>

          {/* Reminders */}
          <div className="mb-3">
            <ReminderChips activeOffsets={localReminders}
              onToggle={(offset, enabled) => {
                setLocalReminders(prev =>
                  enabled ? [...prev, offset] : prev.filter(o => o !== offset)
                );
                updateTask(task.id, { reminders: { [offset]: enabled } })
                  .then(() => mutateTask())
                  .catch(console.error);
              }} />
          </div>

          {/* Comments */}
          <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <CommentThread comments={commentsData || []}
              onAdd={async (text) => {
                await addComment(task.id, text);
                mutateComments();
              }} />
          </div>
        </div>
      </div>
    </>
  );
}
