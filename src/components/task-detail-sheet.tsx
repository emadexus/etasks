"use client";

import { useState, useEffect, useCallback } from "react";
import { useTaskDetail, useComments, useTaskActions, useMembers } from "@/hooks/use-board";
import { CommentThread } from "./comment-thread";
import { ReminderChips } from "./reminder-chips";
import { CalendarPicker } from "./calendar-picker";
import { t } from "@/lib/i18n";

interface TaskDetailSheetProps {
  taskId: string | null;
  chatId: string | null;
  onClose: () => void;
}

function getStatusMap() {
  return {
    todo: { label: t("statusTodo"), color: "var(--text-muted)", next: "in_progress" },
    in_progress: { label: t("statusInProgress"), color: "var(--accent-blue)", next: "done" },
    done: { label: t("statusDone"), color: "var(--accent-green)", next: "todo" },
  } as Record<string, { label: string; color: string; next: string }>;
}

function getPriorityMap() {
  return {
    low: { label: t("priorityLowFull"), color: "var(--text-dim)", next: "medium" },
    medium: { label: t("priorityMediumFull"), color: "var(--accent-yellow)", next: "high" },
    high: { label: t("priorityHighFull"), color: "var(--accent-orange)", next: "low" },
  } as Record<string, { label: string; color: string; next: string }>;
}

function CycleLabel({ value, map, onCycle }: {
  value: string;
  map: Record<string, { label: string; color: string; next: string }>;
  onCycle: (next: string) => void;
}) {
  const item = map[value] || Object.values(map)[0];
  return (
    <span
      className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors active:opacity-70"
      style={{ color: item.color, background: `${item.color}18` }}
      onClick={(e) => { e.stopPropagation(); onCycle(item.next); }}
    >
      {item.label}
    </span>
  );
}

function AssigneePicker({ assignee, members, onChange }: {
  assignee: any;
  members: any[];
  onChange: (memberId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block">
      <span
        className="cursor-pointer text-[11px] font-medium transition-colors active:opacity-70"
        style={{ color: assignee ? "var(--accent-blue)" : "var(--text-dim)" }}
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        {assignee ? `@${assignee.username || assignee.firstName}` : t("unassigned")}
      </span>
      {open && (
        <>
          <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-[60] mt-1 min-w-[160px] overflow-hidden rounded-xl p-1 shadow-xl"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-card)" }}
          >
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-[12px] transition-colors active:bg-white/5"
              style={{ color: "var(--text-muted)" }}
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            >
              {t("unassign")}
            </button>
            {members.map((m: any) => (
              <button key={m.id}
                className="block w-full rounded-lg px-3 py-2 text-left text-[12px] transition-colors active:bg-white/5"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => { e.stopPropagation(); onChange(m.id); setOpen(false); }}
              >
                {m.firstName} {m.username ? `@${m.username}` : ""}
              </button>
            ))}
            {members.length === 0 && (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-dim)" }}>
                {t("noMembersFound")}
              </div>
            )}
          </div>
        </>
      )}
    </span>
  );
}

function formatDate(d: Date | null): string {
  if (!d) return t("notSet");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TaskDetailSheet({ taskId, chatId, onClose }: TaskDetailSheetProps) {
  const { data: taskData, mutate: mutateTask } = useTaskDetail(taskId);
  const { data: commentsData, mutate: mutateComments } = useComments(taskId);
  const { data: membersData } = useMembers(chatId);
  const { updateTask, addComment } = useTaskActions(chatId);

  const [localTask, setLocalTask] = useState<any>(null);
  const [localReminders, setLocalReminders] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

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
    setLocalTask((prev: any) => prev ? { ...prev, [field]: value } : prev);
    setSaving(true);
    setPendingUpdates(n => n + 1);

    updateTask(localTask?.id || taskId!, { [field]: value })
      .then(() => { setPendingUpdates(n => n - 1); mutateTask(); })
      .catch((e) => { console.error(e); setPendingUpdates(n => n - 1); setSaving(false); });
  }, [localTask, taskId, updateTask, mutateTask]);

  const handleMultiUpdate = useCallback(async (updates: Record<string, any>) => {
    setLocalTask((prev: any) => prev ? { ...prev, ...updates } : prev);
    setSaving(true);
    setPendingUpdates(n => n + 1);

    updateTask(localTask?.id || taskId!, updates)
      .then(() => { setPendingUpdates(n => n - 1); mutateTask(); })
      .catch((e) => { console.error(e); setPendingUpdates(n => n - 1); setSaving(false); });
  }, [localTask, taskId, updateTask, mutateTask]);

  if (!taskId || !localTask) return null;

  const task = localTask;
  const assignee = taskData?.assignee;
  const dateDue = task.dateDue ? new Date(task.dateDue) : null;
  const datePlanned = task.datePlanned ? new Date(task.datePlanned) : null;
  const isOverdue = dateDue ? dateDue.getTime() < Date.now() : false;
  const isBoard = !!task.boardId;

  const statusMap = getStatusMap();
  const priorityMap = getPriorityMap();

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-2xl"
        style={{ background: "var(--bg-secondary)" }}
      >
        <div className="flex-shrink-0 px-4 pt-3">
          <div className="mx-auto mb-1 h-1 w-8 rounded-full" style={{ background: "var(--text-dim)" }} />
          <div className="h-4 text-center text-[10px]" style={{ color: "var(--text-dim)" }}>
            {saving ? t("saving") : ""}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          <input
            className="mb-1 w-full bg-transparent text-[16px] font-semibold outline-none"
            style={{ color: "var(--text-primary)" }}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && handleUpdate("title", title)}
          />

          <textarea
            className="mb-3 w-full resize-none bg-transparent text-[13px] outline-none"
            style={{ color: "var(--text-secondary)" }}
            placeholder={t("addDescription")}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description || "") && handleUpdate("description", description)}
          />

          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <CycleLabel value={task.status} map={statusMap} onCycle={(next) => handleUpdate("status", next)} />
            <CycleLabel value={task.priority} map={priorityMap} onCycle={(next) => handleUpdate("priority", next)} />
            {isBoard && (
              <AssigneePicker
                assignee={assignee}
                members={membersData || []}
                onChange={(id) => handleUpdate("assigneeId", id)}
              />
            )}
          </div>

          <button
            className="mb-3 w-full rounded-xl px-3 py-2.5 text-left transition-colors active:bg-white/5"
            style={{ background: "var(--bg-card)" }}
            onClick={() => setShowCalendar(true)}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  {t("due")}
                </div>
                <div className="text-[13px]" style={{ color: isOverdue ? "var(--accent-red)" : "var(--text-primary)" }}>
                  {formatDate(dateDue)}
                </div>
              </div>
              <div className="h-6" style={{ width: 1, background: "var(--border-separator)" }} />
              <div className="flex-1">
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  {t("planned")}
                </div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                  {formatDate(datePlanned)}
                </div>
              </div>
            </div>

            {task.recurrenceRule && (
              <div className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--accent-purple)" }}>
                <span>↻</span>
                <span>
                  {(() => {
                    try {
                      const rule = JSON.parse(task.recurrenceRule);
                      return `${t("repeats")} ${t(rule.type as any) || rule.type}`;
                    } catch { return t("recurring"); }
                  })()}
                </span>
              </div>
            )}
          </button>

          {dateDue && (
            <div className="mb-3">
              <ReminderChips
                activeOffsets={localReminders}
                onToggle={(offset, enabled) => {
                  setLocalReminders(prev =>
                    enabled ? [...prev, offset] : prev.filter(o => o !== offset)
                  );
                  updateTask(task.id, { reminders: { [offset]: enabled } })
                    .then(() => mutateTask())
                    .catch(console.error);
                }}
              />
            </div>
          )}

          {(isBoard || (commentsData && commentsData.length > 0)) && (
            <div className="border-t pt-3" style={{ borderColor: "var(--border-separator)" }}>
              <CommentThread
                comments={commentsData || []}
                onAdd={async (text) => {
                  await addComment(task.id, text);
                  mutateComments();
                }}
              />
            </div>
          )}
        </div>
      </div>

      {showCalendar && (
        <CalendarPicker
          dateDue={dateDue}
          datePlanned={datePlanned}
          notifyAt={task.notifyAt ? new Date(task.notifyAt) : null}
          recurrenceRule={task.recurrenceRule}
          onAccept={(updates) => { handleMultiUpdate(updates); setShowCalendar(false); }}
          onCancel={() => setShowCalendar(false)}
        />
      )}
    </>
  );
}
