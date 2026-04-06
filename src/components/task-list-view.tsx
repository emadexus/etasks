"use client";

import { useState, useMemo } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { useFilteredTasks, useTasks, useMembers, useTaskActions, useUser } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { TaskDetailSheet } from "./task-detail-sheet";

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
              background: active === tab.key ? "var(--accent-red)" : "var(--text-dim)",
              color: "#fff",
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
  const [subTab, setSubTab] = useState<SubTab>("all");
  const { userId } = useTelegram();
  const { data: userData } = useUser();

  const isBoard = context.type === "board";
  const chatId = isBoard ? context.chatId : null;
  const filter = context.type === "filter" ? context.filter : "all";
  const projectId = context.type === "project" ? context.projectId : undefined;

  const { data: boardTasksData, isLoading: boardLoading } = useTasks(isBoard ? chatId : null, {});
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

  // Find current user's member ID for this board
  const currentMemberId = useMemo(() => {
    if (!membersData || !userId) return null;
    const me = (membersData as any[]).find((m: any) => m.telegramUserId?.toString() === userId);
    return me?.id || null;
  }, [membersData, userId]);

  // Find current user's DB ID for non-board views
  const currentDbUserId = userData?.id || null;

  // Filter by sub-tab
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
        // Personal tasks don't have assignees, return empty
        return [];
      }
    }
    return taskItems;
  }, [taskItems, subTab, isBoard, currentMemberId, currentDbUserId]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const allCount = taskItems.filter((t: any) => t.task.status !== "done").length;

    let authorCount = 0;
    let assigneeCount = 0;

    if (isBoard && currentMemberId) {
      authorCount = taskItems.filter((t: any) => t.task.createdBy === currentMemberId && t.task.status !== "done").length;
      assigneeCount = taskItems.filter((t: any) => t.task.assigneeId === currentMemberId && t.task.status !== "done").length;
    } else if (currentDbUserId) {
      authorCount = taskItems.filter((t: any) => t.task.ownerId === currentDbUserId && t.task.status !== "done").length;
      assigneeCount = 0;
    }

    return { all: allCount, author: authorCount, assignee: assigneeCount };
  }, [taskItems, isBoard, currentMemberId, currentDbUserId]);

  const activeTasks = filteredByTab.filter((t: any) => t.task.status !== "done");
  const doneTasks = filteredByTab.filter((t: any) => t.task.status === "done");
  const sortedTasks = [...activeTasks, ...doneTasks];

  const tabs: { key: SubTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: tabCounts.all },
    { key: "author", label: "Author", count: tabCounts.author },
    { key: "assignee", label: "Assignee", count: tabCounts.assignee },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-8 pt-3">
      {/* Header */}
      <div className="mb-3 flex items-center gap-2">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] transition-colors active:bg-white/5"
          style={{ color: "var(--accent-purple)" }}
          onClick={onBack}
        >
          ‹
        </button>
        <div className="flex-1 text-center">
          <div className="text-[17px] font-semibold tracking-tight">{context.label}</div>
        </div>
        {/* Spacer to center title */}
        <div className="w-8" />
      </div>

      {/* Sub-tabs */}
      <TabBar tabs={tabs} active={subTab} onChange={setSubTab} />

      {/* Quick add */}
      <div className="mb-3">
        <QuickAdd
          onAdd={async (title) => {
            if (isBoard) {
              await createTask({ title });
            } else {
              await createTask({
                title,
                chatId: undefined,
                projectId: projectId,
              });
            }
          }}
        />
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-1.5">
        {isLoading && (
          <p className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>Loading tasks...</p>
        )}
        {!isLoading && sortedTasks.length === 0 && (
          <p className="py-12 text-center text-[13px]" style={{ color: "var(--text-muted)" }}>
            No tasks yet.
          </p>
        )}
        {sortedTasks.map((item: any) => (
          <TaskCard
            key={item.task.id}
            task={item.task}
            assignee={item.assignee}
            commentCount={item.commentCount || 0}
            onTap={setSelectedTaskId}
            onToggleStatus={async (id, newStatus) => {
              await updateTask(id, { status: newStatus });
            }}
          />
        ))}
      </div>

      <TaskDetailSheet
        taskId={selectedTaskId}
        chatId={chatId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
