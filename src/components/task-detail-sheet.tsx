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

const statusOptions = [
  { key: "todo", label: "To do", color: "var(--text-muted)" },
  { key: "in_progress", label: "In progress", color: "var(--accent-blue)" },
  { key: "done", label: "Done", color: "#22c55e" },
];

const priorityOptions = [
  { key: "low", label: "Low", color: "var(--text-dim)" },
  { key: "medium", label: "Medium", color: "var(--accent-yellow)" },
  { key: "high", label: "High", color: "var(--accent-orange)" },
];

function MetaChip({ label, value, valueColor, options, onChange }: {
  label: string; value: string; valueColor: string;
  options?: { key: string; label: string; color: string }[];
  onChange?: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button className="rounded-lg px-2.5 py-1.5 text-[11px]"
        style={{ background: "rgba(255,255,255,0.03)" }}
        onClick={(e) => { e.stopPropagation(); options && setOpen(!open); }}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span><br />
        <span style={{ color: valueColor }}>{value}</span>
      </button>
      {open && options && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[60] mt-1 min-w-[120px] rounded-lg border p-1 shadow-lg"
            style={{ background: "var(--bg-primary)", borderColor: "var(--border-card)" }}>
            {options.map((o) => (
              <button key={o.key} className="block w-full rounded px-3 py-2 text-left text-[12px] transition-colors hover:bg-white/5"
                style={{ color: o.color }}
                onClick={(e) => { e.stopPropagation(); onChange?.(o.key); setOpen(false); }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
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

  // Sync from server data
  useEffect(() => {
    if (taskData?.task) {
      setLocalTask(taskData.task);
      setTitle(taskData.task.title);
      setDescription(taskData.task.description || "");
      const offsets = (taskData.reminders || [])
        .filter((r: any) => !r.sent)
        .map((r: any) => r.offsetLabel);
      setLocalReminders(offsets);
    }
  }, [taskData]);

  // Optimistic update — update local state immediately, then fire API in background
  const handleUpdate = useCallback(async (field: string, value: any) => {
    // Update local state immediately
    setLocalTask((prev: any) => prev ? { ...prev, [field]: value } : prev);

    // Fire API in background — no await blocking the UI
    updateTask(localTask?.id || taskId!, { [field]: value })
      .then(() => mutateTask())
      .catch(console.error);
  }, [localTask, taskId, updateTask, mutateTask]);

  if (!taskId || !localTask) return null;

  const task = localTask;
  const assignee = taskData?.assignee;

  const currentStatus = statusOptions.find((s) => s.key === task.status) || statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.key === task.priority) || priorityOptions[1];
  const deadlineDate = new Date(task.deadline);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl border-t"
        style={{ background: "var(--bg-secondary)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        {/* Handle */}
        <div className="flex-shrink-0 px-4 pt-3">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: "var(--text-dim)" }} />
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

          {/* Meta chips */}
          <div className="mb-3 flex flex-wrap gap-2">
            <MetaChip label="Status" value={currentStatus.label} valueColor={currentStatus.color}
              options={statusOptions} onChange={(key) => handleUpdate("status", key)} />
            <MetaChip label="Priority" value={currentPriority.label} valueColor={currentPriority.color}
              options={priorityOptions} onChange={(key) => handleUpdate("priority", key)} />
            <MetaChip label="Assignee" value={assignee?.firstName || "None"} valueColor="var(--text-primary)"
              options={[
                { key: "", label: "None", color: "var(--text-muted)" },
                ...(membersData || []).map((m: any) => ({ key: m.id, label: m.firstName, color: "var(--text-primary)" })),
              ]}
              onChange={(key) => handleUpdate("assigneeId", key || null)} />
            <MetaChip label="Due"
              value={deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              valueColor={deadlineDate.getTime() < Date.now() ? "var(--accent-red)" : "var(--text-primary)"} />
          </div>

          {/* Reminders */}
          <div className="mb-3">
            <ReminderChips activeOffsets={localReminders}
              onToggle={(offset, enabled) => {
                // Optimistic toggle
                setLocalReminders(prev =>
                  enabled ? [...prev, offset] : prev.filter(o => o !== offset)
                );
                // Fire API in background
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
