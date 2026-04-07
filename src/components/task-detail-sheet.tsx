"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useTaskDetail, useComments, useTaskActions, useMembers, useAttachments, useAttachmentActions, useHome } from "@/hooks/use-board";
import { useTelegram } from "./telegram-provider";
import { CommentThread } from "./comment-thread";
import { ReminderChips } from "./reminder-chips";
import { CalendarPicker } from "./calendar-picker";
import { useToast } from "./toast";
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
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < 200) {
        setPos({ bottom: window.innerHeight - rect.top + 4, right });
      } else {
        setPos({ top: rect.bottom + 4, right });
      }
    }
    setOpen(!open);
  };

  return (
    <span className="relative inline-block" ref={triggerRef}>
      <span
        className="cursor-pointer text-[11px] font-medium transition-colors active:opacity-70"
        style={{ color: assignee ? "var(--accent-blue)" : "var(--text-dim)" }}
        onClick={handleOpen}
      >
        {assignee ? `@${assignee.username || assignee.firstName}` : t("unassigned")}
      </span>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[101] min-w-[160px] overflow-hidden rounded-xl p-1 shadow-xl"
            style={{ top: pos.top, right: pos.right, background: "var(--bg-secondary)", border: "1px solid var(--border-card)" }}
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
        </>,
        document.body
      )}
    </span>
  );
}

function BoardPicker({ currentBoardId, boards, onMove }: {
  currentBoardId: string | null;
  boards: { id: string; name: string; chatId: string }[];
  onMove: (boardId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const currentLabel = currentBoardId
    ? boards.find(b => b.id === currentBoardId)?.name || "?"
    : t("personalInbox");

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const right = window.innerWidth - rect.right;
      if (spaceBelow < 200) {
        setPos({ bottom: window.innerHeight - rect.top + 4, right });
      } else {
        setPos({ top: rect.bottom + 4, right });
      }
    }
    setOpen(!open);
  };

  return (
    <span className="relative inline-block" ref={triggerRef}>
      <span
        className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors active:opacity-70"
        style={{ color: "var(--accent-orange)", background: "var(--accent-orange)18" }}
        onClick={handleOpen}
      >
        {currentLabel} ›
      </span>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[101] min-w-[180px] overflow-hidden rounded-xl p-1 shadow-xl"
            style={{ top: pos.top, right: pos.right, background: "var(--bg-secondary)", border: "1px solid var(--border-card)" }}
          >
            {/* Personal inbox option */}
            {currentBoardId !== null && (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors active:bg-white/5"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => { e.stopPropagation(); onMove(null); setOpen(false); }}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded text-[10px]" style={{ background: "var(--accent-orange)", color: "#fff" }}>▣</span>
                {t("personalInbox")}
              </button>
            )}
            {/* Board options */}
            {boards
              .filter(b => b.id !== currentBoardId)
              .map((b) => (
                <button
                  key={b.id}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors active:bg-white/5"
                  style={{ color: "var(--text-primary)" }}
                  onClick={(e) => { e.stopPropagation(); onMove(b.id); setOpen(false); }}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold" style={{ background: "var(--accent-blue)", color: "#fff" }}>
                    {b.name[0].toUpperCase()}
                  </span>
                  {b.name}
                </button>
              ))}
            {boards.length === 0 && currentBoardId === null && (
              <div className="px-3 py-2 text-[11px]" style={{ color: "var(--text-dim)" }}>
                {t("noTasksYet")}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </span>
  );
}

function formatDate(d: Date | null, lang: string = "en"): string {
  if (!d) return t("notSet");
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TaskDetailSheet({ taskId, chatId, onClose }: TaskDetailSheetProps) {
  const { data: taskData, mutate: mutateTask } = useTaskDetail(taskId);
  const { data: commentsData, mutate: mutateComments } = useComments(taskId);
  const { data: membersData } = useMembers(chatId);
  const { updateTask, addComment, moveTask } = useTaskActions(chatId);
  const { data: attachmentsData, mutate: mutateAttachments } = useAttachments(taskId);
  const { uploadFile } = useAttachmentActions();
  const { data: homeData } = useHome();
  const { showToast } = useToast();
  const { lang } = useTelegram();

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
      .then(() => {
        setPendingUpdates(n => n - 1);
        // Optimistic: update SWR cache with the new value to avoid old→new flash
        mutateTask((current: any) => current ? { ...current, task: { ...current.task, [field]: value } } : current, { revalidate: true });
      })
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

          {/* Field rows — iOS Settings style */}
          <div className="mb-3 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
            {/* Status */}
            <div
              className="flex items-center justify-between px-3.5 py-2.5 transition-colors active:bg-white/5"
              style={{ cursor: "pointer" }}
              onClick={() => handleUpdate("status", statusMap[task.status]?.next || "todo")}
            >
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("statusLabel")}</span>
              <span className="text-[13px] font-medium" style={{ color: statusMap[task.status]?.color }}>
                {statusMap[task.status]?.label} ›
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border-separator)" }} />

            {/* Priority */}
            <div
              className="flex items-center justify-between px-3.5 py-2.5 transition-colors active:bg-white/5"
              style={{ cursor: "pointer" }}
              onClick={() => handleUpdate("priority", priorityMap[task.priority]?.next || "medium")}
            >
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("priorityLabel")}</span>
              <span className="text-[13px] font-medium" style={{ color: priorityMap[task.priority]?.color }}>
                {priorityMap[task.priority]?.label} ›
              </span>
            </div>

            {/* Assignee — only for board tasks */}
            {isBoard && (
              <>
                <div style={{ borderTop: "1px solid var(--border-separator)" }} />
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("assigneeLabel")}</span>
                  <AssigneePicker
                    assignee={assignee}
                    members={membersData || []}
                    onChange={(id) => handleUpdate("assigneeId", id)}
                  />
                </div>
              </>
            )}

            <div style={{ borderTop: "1px solid var(--border-separator)" }} />

            {/* Board */}
            <div className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-[13px]" style={{ color: "var(--text-muted)" }}>{t("boardLabel")}</span>
              <BoardPicker
                currentBoardId={task.boardId}
                boards={homeData?.boards || []}
                onMove={async (newBoardId) => {
                  await moveTask(task.id, newBoardId);
                  mutateTask();
                  onClose();
                }}
              />
            </div>
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
                  {formatDate(dateDue, lang)}
                </div>
              </div>
              <div className="h-6" style={{ width: 1, background: "var(--border-separator)" }} />
              <div className="flex-1">
                <div className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                  {t("planned")}
                </div>
                <div className="text-[13px]" style={{ color: "var(--text-primary)" }}>
                  {formatDate(datePlanned, lang)}
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

          {/* Attachments */}
          <div className="mb-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
                {lang === "ru" ? "Файлы" : "Files"}
              </span>
              <label
                className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-medium transition-colors active:bg-white/5"
                style={{ color: "var(--accent-blue)" }}
              >
                {lang === "ru" ? "Прикрепить" : "Attach"}
                <input
                  type="file"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !task.id) return;
                    try {
                      await uploadFile(task.id, file);
                      mutateAttachments();
                    } catch (err) {
                      console.error("Upload failed:", err);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {attachmentsData && attachmentsData.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {attachmentsData.map((att: any) => (
                  <a
                    key={att.id}
                    href={att.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 transition-colors active:bg-white/5"
                    style={{ background: "var(--bg-card)" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-[14px]">📎</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]" style={{ color: "var(--text-primary)" }}>
                      {att.fileName}
                    </span>
                    {att.fileSize && (
                      <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>
                        {att.fileSize > 1048576 ? `${(att.fileSize / 1048576).toFixed(1)}MB` : `${Math.round(att.fileSize / 1024)}KB`}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}
          </div>

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

          {/* Actions — share + archive */}
          <div className="mt-6 border-t pt-4" style={{ borderColor: "var(--border-separator)" }}>
            <div className="flex gap-2">
              <button
                className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-medium transition-colors active:opacity-70"
                style={{ color: "var(--accent-blue)", background: "var(--bg-card)" }}
                onClick={() => {
                  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
                  const link = `https://t.me/${botUsername}/app?startapp=task${task.id}`;
                  if (navigator.clipboard?.writeText) {
                    navigator.clipboard.writeText(link).then(() => showToast(lang === "ru" ? "Ссылка скопирована" : "Link copied"));
                  } else {
                    // Fallback for Telegram WebView
                    const ta = document.createElement("textarea");
                    ta.value = link;
                    ta.style.position = "fixed";
                    ta.style.opacity = "0";
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    showToast(lang === "ru" ? "Ссылка скопирована" : "Link copied");
                  }
                }}
              >
                {lang === "ru" ? "Скопировать ссылку" : "Copy link"}
              </button>
              <button
                className="flex-1 rounded-xl py-2.5 text-center text-[12px] font-medium transition-colors active:opacity-70"
                style={{
                  color: task.archivedAt ? "var(--accent-blue)" : "var(--text-dim)",
                  background: "var(--bg-card)",
                }}
                onClick={async () => {
                  const val = task.archivedAt ? null : new Date().toISOString();
                  await handleUpdate("archivedAt", val);
                  showToast(val ? t("taskArchived") : t("taskUnarchived"));
                  if (val) onClose();
                }}
              >
                {task.archivedAt ? t("unarchiveTask") : t("archiveTask")}
              </button>
            </div>
          </div>
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
