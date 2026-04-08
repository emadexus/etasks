"use client";

import { useState, useEffect, useCallback } from "react";
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
  boardId?: string | null;
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
    <>
      <span
        className="cursor-pointer text-[11px] font-medium transition-colors active:opacity-70"
        style={{ color: assignee ? "var(--accent-blue)" : "var(--text-dim)" }}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        {assignee ? `@${assignee.username || assignee.firstName}` : t("unassigned")}
      </span>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[101] max-h-[60vh] overflow-y-auto rounded-t-2xl px-2 pb-8 pt-3"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="mx-auto mb-3 h-1 w-8 rounded-full" style={{ background: "var(--text-dim)" }} />
            <button
              className="block w-full rounded-lg px-3 py-3 text-left text-[14px] transition-colors active:bg-white/5"
              style={{ color: "var(--text-muted)" }}
              onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }}
            >
              {t("unassign")}
            </button>
            {members.map((m: any) => (
              <button key={m.id}
                className="block w-full rounded-lg px-3 py-3 text-left text-[14px] transition-colors active:bg-white/5"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => { e.stopPropagation(); onChange(m.id); setOpen(false); }}
              >
                {m.firstName} {m.username ? `@${m.username}` : ""}
              </button>
            ))}
            {members.length === 0 && (
              <div className="px-3 py-3 text-[13px]" style={{ color: "var(--text-dim)" }}>
                {t("noMembersFound")}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function BoardPicker({ currentBoardId, boards, onMove }: {
  currentBoardId: string | null;
  boards: { id: string; name: string; chatId: string }[];
  onMove: (boardId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const currentLabel = currentBoardId
    ? boards.find(b => b.id === currentBoardId)?.name || "?"
    : t("personalInbox");

  return (
    <>
      <span
        className="cursor-pointer rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors active:opacity-70"
        style={{ color: "var(--accent-orange)", background: "var(--accent-orange)18" }}
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
      >
        {currentLabel} ›
      </span>
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => setOpen(false)} />
          <div
            className="fixed inset-x-0 bottom-0 z-[101] max-h-[60vh] overflow-y-auto rounded-t-2xl px-2 pb-8 pt-3"
            style={{ background: "var(--bg-secondary)" }}
          >
            <div className="mx-auto mb-3 h-1 w-8 rounded-full" style={{ background: "var(--text-dim)" }} />
            {/* Personal inbox option */}
            {currentBoardId !== null && (
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[14px] transition-colors active:bg-white/5"
                style={{ color: "var(--text-primary)" }}
                onClick={(e) => { e.stopPropagation(); onMove(null); setOpen(false); }}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded text-[11px]" style={{ background: "var(--accent-orange)", color: "#fff" }}>▣</span>
                {t("personalInbox")}
              </button>
            )}
            {/* Board options */}
            {boards
              .filter(b => b.id !== currentBoardId)
              .map((b) => (
                <button
                  key={b.id}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-3 text-left text-[14px] transition-colors active:bg-white/5"
                  style={{ color: "var(--text-primary)" }}
                  onClick={(e) => { e.stopPropagation(); onMove(b.id); setOpen(false); }}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded text-[11px] font-semibold" style={{ background: "var(--accent-blue)", color: "#fff" }}>
                    {b.name[0].toUpperCase()}
                  </span>
                  {b.name}
                </button>
              ))}
            {boards.length === 0 && currentBoardId === null && (
              <div className="px-3 py-3 text-[13px]" style={{ color: "var(--text-dim)" }}>
                {t("noTasksYet")}
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

function formatDate(d: Date | null, lang: string = "en"): string {
  if (!d) return t("notSet");
  const locale = lang === "ru" ? "ru-RU" : "en-US";
  return d.toLocaleDateString(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function TaskDetailSheet({ taskId, chatId, boardId: propBoardId, onClose }: TaskDetailSheetProps) {
  const isDraft = !taskId;
  const [createdId, setCreatedId] = useState<string | null>(null);
  const activeId = taskId || createdId;

  const { data: taskData, mutate: mutateTask } = useTaskDetail(activeId);
  const { data: commentsData, mutate: mutateComments } = useComments(activeId);
  const { data: homeData } = useHome();

  // Resolve the correct chatId from the task's boardId (not the URL's chatId)
  const taskBoardId = taskData?.task?.boardId;
  const resolvedChatId = taskBoardId
    ? (homeData?.boards as any[])?.find((b: any) => b.id === taskBoardId)?.chatId || chatId
    : chatId;

  const { data: membersData } = useMembers(resolvedChatId);
  const { updateTask, addComment, moveTask, deleteTask, createTask } = useTaskActions(resolvedChatId);
  const { data: attachmentsData, mutate: mutateAttachments } = useAttachments(activeId);
  const { uploadFile } = useAttachmentActions();
  const { showToast } = useToast();
  const { lang } = useTelegram();

  const [localTask, setLocalTask] = useState<any>(isDraft ? {
    id: null, status: "todo", priority: "medium", boardId: propBoardId || null,
    assigneeId: null, dateDue: null, datePlanned: null, tags: null,
    recurrenceRule: null, archivedAt: null, description: null,
  } : null);
  // Update draft boardId when homeData loads
  useEffect(() => {
    if (isDraft && !createdId && chatId && homeData?.boards) {
      const bid = (homeData.boards as any[]).find((b: any) => b.chatId === chatId)?.id || null;
      if (bid) setLocalTask((prev: any) => prev && !prev.boardId ? { ...prev, boardId: bid } : prev);
    }
  }, [isDraft, createdId, chatId, homeData]);

  const [localReminders, setLocalReminders] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pendingUpdates, setPendingUpdates] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [checklistInput, setChecklistInput] = useState("");

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

  // Draft: create task when title is entered
  const handleTitleBlur = useCallback(async () => {
    if (isDraft && !createdId) {
      if (!title.trim()) return; // no title = no task
      setSaving(true);
      try {
        const result = await createTask({ title: title.trim(), chatId: chatId || undefined });
        if (result?.id) {
          setCreatedId(result.id);
          setLocalTask((prev: any) => prev ? { ...prev, id: result.id } : prev);
        }
      } catch (e) {
        console.error("Failed to create task:", e);
      }
      setSaving(false);
    } else if (activeId && title !== (taskData?.task?.title || "")) {
      handleUpdate("title", title);
    }
  }, [isDraft, createdId, title, chatId, createTask, activeId, taskData]);

  const handleUpdate = useCallback(async (field: string, value: any) => {
    if (!activeId) return;
    setLocalTask((prev: any) => prev ? { ...prev, [field]: value } : prev);
    setSaving(true);
    setPendingUpdates(n => n + 1);

    updateTask(activeId, { [field]: value })
      .then(async () => {
        await mutateTask((current: any) => {
          if (!current) return current;
          const updated: any = { ...current, task: { ...current.task, [field]: value } };
          if (field === "assigneeId") {
            updated.assignee = value
              ? (membersData || []).find((m: any) => m.id === value) || current.assignee
              : null;
          }
          return updated;
        }, { revalidate: false });
        setPendingUpdates(n => n - 1);
      })
      .catch((e) => { console.error(e); setPendingUpdates(n => n - 1); setSaving(false); });
  }, [activeId, updateTask, mutateTask, membersData]);

  const handleMultiUpdate = useCallback(async (updates: Record<string, any>) => {
    if (!activeId) return;
    setLocalTask((prev: any) => prev ? { ...prev, ...updates } : prev);
    setSaving(true);
    setPendingUpdates(n => n + 1);

    updateTask(activeId, updates)
      .then(async () => { await mutateTask((current: any) => current ? { ...current, task: { ...current.task, ...updates } } : current, { revalidate: false }); setPendingUpdates(n => n - 1); })
      .catch((e) => { console.error(e); setPendingUpdates(n => n - 1); setSaving(false); });
  }, [activeId, updateTask, mutateTask]);

  // For drafts, show the empty card. For existing tasks, wait for data.
  if (!isDraft && !localTask) return null;
  if (!localTask) return null;

  const task = localTask;
  const assignee = taskData?.assignee;
  const tags: string[] = task.tags ? (typeof task.tags === "string" ? JSON.parse(task.tags) : task.tags) : [];
  const checklist: { text: string; done: boolean }[] = task.checklist
    ? (typeof task.checklist === "string" ? JSON.parse(task.checklist) : task.checklist)
    : [];
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
        <div className="flex-shrink-0 px-4 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <div className="flex-1" />
            <div className="mx-auto h-1 w-10 cursor-pointer rounded-full" style={{ background: "var(--text-dim)" }} onClick={onClose} />
            <div className="flex flex-1 justify-end">
              {activeId && (
                <button
                  className="rounded-md p-1 transition-colors active:bg-white/10"
                  style={{ color: "var(--text-dim)" }}
                  onClick={() => {
                    const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || "e_task_bot";
                    const link = `https://t.me/${botUsername}/open?startapp=task${task.id}`;
                    if (navigator.clipboard?.writeText) {
                      navigator.clipboard.writeText(link).then(() => showToast(lang === "ru" ? "Ссылка скопирована" : "Link copied"));
                    } else {
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
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
                    <path d="M10.5 5.5V3.5a1.5 1.5 0 00-1.5-1.5H3.5A1.5 1.5 0 002 3.5V9a1.5 1.5 0 001.5 1.5h2" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          <div className="mt-1 h-3 text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
            {saving ? t("saving") : ""}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {/* Title — multi-line */}
          <textarea
            ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
            autoFocus={isDraft}
            className="mb-1 w-full resize-none bg-transparent text-[17px] font-semibold leading-snug outline-none"
            style={{ color: "var(--text-primary)" }}
            placeholder={isDraft ? (lang === "ru" ? "Название задачи..." : "Task title...") : ""}
            rows={1}
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }}
          />

          <textarea
            className="mb-3 w-full resize-none bg-transparent text-[13px] outline-none"
            style={{ color: "var(--text-secondary)", minHeight: "2.5em" }}
            placeholder={t("addDescription")}
            rows={1}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              // Auto-expand
              const el = e.target;
              el.style.height = "auto";
              el.style.height = el.scrollHeight + "px";
            }}
            onFocus={(e) => { const el = e.target; el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }}
            onBlur={() => description !== (task.description || "") && handleUpdate("description", description)}
          />

          {/* Metadata — compact inline chips */}
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
            <BoardPicker
              currentBoardId={task.boardId}
              boards={homeData?.boards || []}
              onMove={async (newBoardId) => {
                await moveTask(task.id, newBoardId);
                mutateTask();
                showToast(t("taskMoved"));
              }}
            />
          </div>

          {/* Tags */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {tags.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{ background: "var(--accent-purple-bg)", color: "var(--accent-purple)" }}
              >
                {tag}
                <button
                  className="ml-0.5 text-[10px] opacity-60 active:opacity-100"
                  onClick={() => handleUpdate("tags", tags.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              className="min-w-[80px] flex-1 bg-transparent text-[11px] outline-none"
              style={{ color: "var(--text-muted)" }}
              placeholder={tags.length === 0 ? (lang === "ru" ? "Добавить тег..." : "Add tag...") : "+"}
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                  e.preventDefault();
                  const newTag = tagInput.trim().replace(/,/g, "");
                  if (newTag && !tags.includes(newTag)) {
                    handleUpdate("tags", [...tags, newTag]);
                  }
                  setTagInput("");
                }
              }}
              onBlur={() => {
                if (tagInput.trim()) {
                  const newTag = tagInput.trim();
                  if (!tags.includes(newTag)) {
                    handleUpdate("tags", [...tags, newTag]);
                  }
                  setTagInput("");
                }
              }}
            />
          </div>

          {/* Checklist */}
          {(checklist.length > 0 || activeId) && (
            <div className="mb-3 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
              {checklist.length > 0 && (
                <div className="px-1 py-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)", paddingLeft: "14px", paddingTop: "8px" }}>
                  {lang === "ru" ? "Чек-лист" : "Checklist"} · {checklist.filter(c => c.done).length}/{checklist.length}
                </div>
              )}
              {checklist.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2"
                  style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
                >
                  <button
                    className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md transition-colors"
                    style={{
                      border: item.done ? "none" : "1.5px solid var(--text-dim)",
                      background: item.done ? "var(--accent-green)" : "transparent",
                    }}
                    onClick={() => {
                      const updated = checklist.map((c, j) => j === i ? { ...c, done: !c.done } : c);
                      handleUpdate("checklist", updated);
                    }}
                  >
                    {item.done && <span className="text-[11px] text-white">✓</span>}
                  </button>
                  <span
                    className="flex-1 text-[13px]"
                    style={{
                      color: item.done ? "var(--text-dim)" : "var(--text-primary)",
                      textDecoration: item.done ? "line-through" : "none",
                    }}
                  >
                    {item.text}
                  </span>
                  <button
                    className="flex-shrink-0 text-[10px] opacity-40 transition-opacity active:opacity-100"
                    style={{ color: "var(--text-dim)" }}
                    onClick={() => {
                      const updated = checklist.filter((_, j) => j !== i);
                      handleUpdate("checklist", updated.length > 0 ? updated : null);
                    }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 px-3 py-2" style={checklist.length > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}>
                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-[14px]" style={{ color: "var(--text-dim)" }}>+</span>
                <input
                  className="flex-1 bg-transparent text-[13px] outline-none"
                  style={{ color: "var(--text-muted)" }}
                  placeholder={lang === "ru" ? "Добавить пункт..." : "Add item..."}
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && checklistInput.trim()) {
                      e.preventDefault();
                      const updated = [...checklist, { text: checklistInput.trim(), done: false }];
                      handleUpdate("checklist", updated);
                      setChecklistInput("");
                    }
                  }}
                />
              </div>
            </div>
          )}

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

          {/* Bottom actions */}
          <div className="mt-6 flex items-center gap-4">
            <button
              className="text-[11px] transition-colors active:opacity-70"
              style={{ color: task.archivedAt ? "var(--accent-blue)" : "var(--text-muted)" }}
              onClick={async () => {
                const val = task.archivedAt ? null : new Date().toISOString();
                await handleUpdate("archivedAt", val);
                showToast(val ? t("taskArchived") : t("taskUnarchived"));
              }}
            >
              {task.archivedAt ? t("unarchiveTask") : t("archiveTask")}
            </button>
            {task.archivedAt && (
              <button
                className="text-[11px] transition-colors active:opacity-70"
                style={{ color: "var(--accent-red)" }}
                onClick={async () => {
                  await deleteTask(task.id);
                  showToast(lang === "ru" ? "Задача удалена" : "Task deleted");
                  onClose();
                }}
              >
                {lang === "ru" ? "Удалить навсегда" : "Delete permanently"}
              </button>
            )}
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
