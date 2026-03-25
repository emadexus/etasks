"use client";

import { useState, useEffect } from "react";
import { useTaskDetail, useComments, useTaskActions, useMembers } from "@/hooks/use-board";
import { useTelegram } from "@/components/telegram-provider";
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
        onClick={() => options && setOpen(!open)}>
        <span style={{ color: "var(--text-muted)" }}>{label}</span><br />
        <span style={{ color: valueColor }}>{value}</span>
      </button>
      {open && options && (
        <div className="absolute left-0 top-full z-10 mt-1 rounded-lg border p-1"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-card)" }}>
          {options.map((o) => (
            <button key={o.key} className="block w-full rounded px-3 py-1.5 text-left text-[11px]"
              style={{ color: o.color }}
              onClick={() => { onChange?.(o.key); setOpen(false); }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskDetailSheet({ taskId, chatId, onClose }: TaskDetailSheetProps) {
  const { data: taskData, mutate: mutateTask } = useTaskDetail(taskId);
  const { data: commentsData } = useComments(taskId);
  const { data: membersData } = useMembers(chatId);
  const { updateTask, addComment } = useTaskActions(chatId);
  // useTelegram imported but not directly used here — context is consumed via hooks
  useTelegram();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (taskData?.task) {
      setTitle(taskData.task.title);
      setDescription(taskData.task.description || "");
    }
  }, [taskData]);

  if (!taskId || !taskData) return null;

  const { task, assignee, reminders } = taskData;
  const activeOffsets = (reminders || [])
    .filter((r: any) => !r.sent)
    .map((r: any) => r.offsetLabel);

  const handleUpdate = async (field: string, value: any) => {
    await updateTask(task.id, { [field]: value });
    mutateTask();
  };

  const currentStatus = statusOptions.find((s) => s.key === task.status) || statusOptions[0];
  const currentPriority = priorityOptions.find((p) => p.key === task.priority) || priorityOptions[1];
  const deadlineDate = new Date(task.deadline);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t p-4 pb-8"
        style={{ background: "var(--bg-secondary)", borderColor: "rgba(255,255,255,0.08)" }}>
        <div className="mx-auto mb-3 h-1 w-9 rounded-full" style={{ background: "var(--text-dim)" }} />
        <input className="mb-1 w-full bg-transparent text-[16px] font-semibold outline-none"
          value={title} onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== task.title && handleUpdate("title", title)} />
        <textarea className="mb-3 w-full resize-none bg-transparent text-[12px] outline-none"
          style={{ color: "var(--text-muted)" }} placeholder="Add description..." rows={2}
          value={description} onChange={(e) => setDescription(e.target.value)}
          onBlur={() => description !== (task.description || "") && handleUpdate("description", description)} />
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
        <div className="mb-3">
          <ReminderChips activeOffsets={activeOffsets}
            onToggle={async (offset, enabled) => {
              await updateTask(task.id, { reminders: { [offset]: enabled } });
              mutateTask();
            }} />
        </div>
        <div className="border-t pt-3" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <CommentThread comments={commentsData || []}
            onAdd={async (text) => { await addComment(task.id, text); }} />
        </div>
      </div>
    </>
  );
}
