"use client";

import { useState, useMemo, useCallback } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { mutate } from "swr";
import { useFilteredTasks, useTasks, useMembers, useTaskActions, useUser } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { TaskDetailSheet } from "./task-detail-sheet";
import { FabMenu } from "./fab-menu";
import { useToast } from "./toast";
import { t } from "@/lib/i18n";

interface TaskListViewProps {
  context:
    | { type: "filter"; filter: string; label: string }
    | { type: "project"; projectId: string; label: string }
    | { type: "board"; chatId: string; label: string };
  openTaskId?: string;
  onBack: () => void;
}

type SubTab = "all" | "author" | "assignee";

function TabBar({ tabs, active, onChange }: {
  tabs: { key: SubTab; label: string; count: number }[];
  active: SubTab;
  onChange: (tab: SubTab) => void;
}) {
  return (
    <div className="mb-3 flex gap-5" style={{ borderBottom: "1px solid var(--border-separator)" }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className="relative flex items-center gap-1.5 pb-2.5 text-[13px] font-semibold transition-colors"
          style={{ color: active === tab.key ? "var(--accent-purple)" : "var(--text-muted)" }}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span
            className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{
              background: active === tab.key ? "var(--accent-purple)" : "rgba(255,255,255,0.08)",
              color: active === tab.key ? "#fff" : "var(--text-muted)",
            }}
          >
            {tab.count}
          </span>
          {active === tab.key && (
            <div
              className="absolute -bottom-px left-0 right-0 h-[2px] rounded-full"
              style={{ background: "var(--accent-purple)" }}
            />
          )}
        </button>
      ))}
    </div>
  );
}

export function TaskListView({ context, openTaskId, onBack }: TaskListViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(openTaskId || null);
  const [showDraft, setShowDraft] = useState(false);
  const [subTab, setSubTab] = useState<SubTab>("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const { userId } = useTelegram();
  const { showToast } = useToast();
  const { data: userData } = useUser();

  const isBoard = context.type === "board";
  const chatId = isBoard ? context.chatId : null;
  const filter = context.type === "filter" ? context.filter : "all";
  const projectId = context.type === "project" ? context.projectId : undefined;

  const boardFilters: Record<string, string> = showArchived ? { archived: "true" } : {};
  const { data: boardTasksData, isLoading: boardLoading } = useTasks(isBoard ? chatId : null, boardFilters);
  const { data: userTasks, isLoading: userLoading } = useFilteredTasks(
    isBoard ? "" : filter,
    projectId,
    undefined,
  );

  const { data: membersData } = useMembers(chatId);
  const { createTask, updateTask } = useTaskActions(chatId);

  const isLoading = isBoard ? boardLoading : userLoading;

  let taskItems: any[] = [];
  if (isBoard && boardTasksData?.tasks) {
    taskItems = boardTasksData.tasks;
  } else if (!isBoard && userTasks) {
    taskItems = userTasks;
  }

  const currentMemberId = useMemo(() => {
    if (!membersData || !userId) return null;
    const me = (membersData as any[]).find((m: any) => m.telegramUserId?.toString() === userId);
    return me?.id || null;
  }, [membersData, userId]);

  const currentDbUserId = userData?.id || null;

  const filteredByTab = useMemo(() => {
    if (subTab === "all") return taskItems;

    if (isBoard && currentMemberId) {
      if (subTab === "author") {
        return taskItems.filter((t: any) => t.task.createdBy === currentMemberId);
      }
      if (subTab === "assignee") {
        return taskItems.filter((t: any) => t.task.assigneeId === currentMemberId);
      }
    } else if (currentDbUserId) {
      if (subTab === "author") {
        return taskItems.filter((t: any) => t.task.ownerId === currentDbUserId);
      }
      if (subTab === "assignee") {
        return [];
      }
    }
    return taskItems;
  }, [taskItems, subTab, isBoard, currentMemberId, currentDbUserId]);

  const tabCounts = useMemo(() => {
    const allCount = taskItems.filter((t: any) => t.task.status !== "done").length;
    let authorCount = 0;
    let assigneeCount = 0;

    if (isBoard && currentMemberId) {
      authorCount = taskItems.filter((t: any) => t.task.createdBy === currentMemberId && t.task.status !== "done").length;
      assigneeCount = taskItems.filter((t: any) => t.task.assigneeId === currentMemberId && t.task.status !== "done").length;
    } else if (currentDbUserId) {
      authorCount = taskItems.filter((t: any) => t.task.ownerId === currentDbUserId && t.task.status !== "done").length;
    }

    return { all: allCount, author: authorCount, assignee: assigneeCount };
  }, [taskItems, isBoard, currentMemberId, currentDbUserId]);

  // Apply status + tag filters on top of tab filter
  const filteredByStatus = useMemo(() => {
    let items = filteredByTab;
    if (statusFilter) {
      items = items.filter((t: any) => t.task.status === statusFilter);
    }
    if (tagFilter) {
      items = items.filter((t: any) => {
        const tags: string[] = t.task.tags ? (typeof t.task.tags === "string" ? JSON.parse(t.task.tags) : t.task.tags) : [];
        return tags.includes(tagFilter);
      });
    }
    return items;
  }, [filteredByTab, statusFilter, tagFilter]);

  // Collect unique tags from all tasks in view
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const item of taskItems) {
      const tags: string[] = item.task.tags ? (typeof item.task.tags === "string" ? JSON.parse(item.task.tags) : item.task.tags) : [];
      tags.forEach((tag: string) => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }, [taskItems]);

  // Status counts (from tab-filtered, before status/tag filter)
  const statusCounts = useMemo(() => ({
    todo: filteredByTab.filter((t: any) => t.task.status === "todo").length,
    in_progress: filteredByTab.filter((t: any) => t.task.status === "in_progress").length,
    done: filteredByTab.filter((t: any) => t.task.status === "done").length,
  }), [filteredByTab]);

  const activeTasks = filteredByStatus.filter((t: any) => t.task.status !== "done");
  const doneTasks = filteredByStatus.filter((t: any) => t.task.status === "done");
  const sortedTasks = [...activeTasks, ...doneTasks];

  const tabs: { key: SubTab; label: string; count: number }[] = [
    { key: "all", label: t("all"), count: tabCounts.all },
    { key: "author", label: t("author"), count: tabCounts.author },
    { key: "assignee", label: t("assignee"), count: tabCounts.assignee },
  ];

  return (
    <div className="app-scroll-container mx-auto max-w-lg px-4 pb-8 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] transition-colors active:bg-white/5"
          style={{ color: "var(--accent-purple)" }}
          onClick={onBack}
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <div className="text-[17px] font-semibold tracking-tight">
            {context.label}{showArchived ? ` (${t("archived")})` : ""}
          </div>
        </div>
        {isBoard ? (
          <button
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px] transition-colors active:bg-white/5"
            style={{ color: showArchived ? "var(--accent-purple)" : "var(--text-dim)" }}
            onClick={() => setShowArchived(v => !v)}
            title={t("archived")}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="1.5" width="14" height="3.5" rx="1" />
              <path d="M2.5 5v8.5a1.5 1.5 0 001.5 1.5h8a1.5 1.5 0 001.5-1.5V5" />
              <path d="M6.5 8.5h3" />
            </svg>
          </button>
        ) : (
          <div className="w-8" />
        )}
      </div>

      <TabBar tabs={tabs} active={subTab} onChange={setSubTab} />

      {/* Status + Tag filter chips */}
      <div className="mb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {([
          { key: "todo", label: t("statusTodo"), count: statusCounts.todo, color: "var(--text-muted)" },
          { key: "in_progress", label: t("statusInProgress"), count: statusCounts.in_progress, color: "var(--accent-blue)" },
          { key: "done", label: t("statusDone"), count: statusCounts.done, color: "var(--accent-green)" },
        ] as const).map((s) => (
          <button
            key={s.key}
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: statusFilter === s.key ? `${s.color}22` : "var(--bg-card)",
              color: statusFilter === s.key ? s.color : "var(--text-muted)",
              border: statusFilter === s.key ? `1px solid ${s.color}44` : "1px solid transparent",
            }}
            onClick={() => setStatusFilter(statusFilter === s.key ? null : s.key)}
          >
            {s.label} {s.count > 0 && <span className="ml-0.5 opacity-60">{s.count}</span>}
          </button>
        ))}
        {allTags.map((tag) => (
          <button
            key={tag}
            className="flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{
              background: tagFilter === tag ? "var(--accent-purple-bg)" : "var(--bg-card)",
              color: tagFilter === tag ? "var(--accent-purple)" : "var(--text-dim)",
              border: tagFilter === tag ? "1px solid var(--accent-purple)44" : "1px solid transparent",
            }}
            onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
          >
            # {tag}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {isLoading && sortedTasks.length === 0 && (
          <p className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>{t("loadingTasks")}</p>
        )}
        {!isLoading && sortedTasks.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 text-[48px]">📭</div>
            <div className="text-[15px] font-semibold" style={{ color: "var(--text-primary)" }}>
              {isBoard ? t("emptyBoardTitle") : t("emptyInboxTitle")}
            </div>
            <div className="mt-1 text-[13px]" style={{ color: "var(--text-muted)" }}>
              {isBoard ? t("emptyBoardSubtitle") : t("emptyInboxSubtitle")}
            </div>
          </div>
        )}
        {sortedTasks.map((item: any) => (
          <TaskCard
            key={item.task.id}
            task={item.task}
            assignee={item.assignee}
            commentCount={item.commentCount || 0}
            onTap={setSelectedTaskId}
            onToggleStatus={(id, newStatus) => {
              // Optimistic: update local item immediately, then sync in background
              updateTask(id, { status: newStatus });
            }}
          />
        ))}
      </div>

      {selectedTaskId && (
        <TaskDetailSheet
          taskId={selectedTaskId}
          chatId={chatId}
          onClose={() => {
            setSelectedTaskId(null);
            // Refetch list with latest server data
            mutate((key: unknown) => typeof key === "string" && (key.startsWith("/api/tasks") || key.startsWith("/api/user/tasks") || key.startsWith("/api/home")));
          }}
        />
      )}

      <FabMenu onNewTask={() => setShowDraft(true)} />

      {showDraft && (
        <TaskDetailSheet
          taskId={null}
          chatId={chatId}
          boardId={boardTasksData?.board?.id || null}
          onClose={() => {
            setShowDraft(false);
            mutate((key: unknown) => typeof key === "string" && (key.startsWith("/api/tasks") || key.startsWith("/api/user/tasks") || key.startsWith("/api/home")));
          }}
        />
      )}
    </div>
  );
}
