"use client";

import { useState } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { useTasks, useMembers, useTaskActions } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { FilterChips } from "./filter-chips";
import { FilterPanel } from "./filter-panel";
import { TaskDetailSheet } from "./task-detail-sheet";

export function BoardView() {
  const { chatId, userId, ready } = useTelegram();
  const [quickFilter, setQuickFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const apiFilters: Record<string, string> = { ...advancedFilters };
  if (quickFilter === "todo") apiFilters.status = "todo";
  if (quickFilter === "in_progress") apiFilters.status = "in_progress";
  if (quickFilter === "done") apiFilters.status = "done";

  const { data: tasksData, isLoading } = useTasks(chatId, apiFilters);
  const { data: membersData } = useMembers(chatId);
  const { createTask, updateTask } = useTaskActions(chatId);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (!chatId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center">
        <p style={{ color: "var(--text-muted)" }}>Open this app from a Telegram group to get started.</p>
      </div>
    );
  }

  const allTasks = tasksData?.tasks || [];
  const activeTasks = allTasks.filter((t: any) => t.task.status !== "done");
  const doneTasks = allTasks.filter((t: any) => t.task.status === "done");
  const sortedTasks = [...activeTasks, ...doneTasks];

  const filteredTasks = quickFilter === "my"
    ? sortedTasks.filter((t: any) => t.assignee?.telegramUserId?.toString() === userId)
    : sortedTasks;

  const boardName = tasksData?.board?.name || "Task Board";
  const memberCount = membersData?.length || 0;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <div className="text-[17px] font-semibold tracking-tight">{boardName}</div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {memberCount} member{memberCount !== 1 ? "s" : ""}
          </div>
        </div>
        <button className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setFilterPanelOpen(true)}>
          &#9776;
        </button>
      </div>

      <div className="mb-4">
        <FilterChips active={quickFilter} onChange={setQuickFilter} />
      </div>

      <div className="mb-3">
        <QuickAdd onAdd={async (title) => { await createTask({ title }); }} />
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && (
          <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>Loading tasks...</p>
        )}
        {!isLoading && filteredTasks.length === 0 && (
          <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>No tasks yet. Add one above.</p>
        )}
        {filteredTasks.map((item: any) => (
          <TaskCard key={item.task.id} task={item.task} assignee={item.assignee}
            commentCount={item.commentCount || 0}
            onTap={setSelectedTaskId}
            onToggleStatus={async (id, newStatus) => { await updateTask(id, { status: newStatus }); }} />
        ))}
      </div>

      <TaskDetailSheet taskId={selectedTaskId} chatId={chatId} onClose={() => setSelectedTaskId(null)} />
      <FilterPanel open={filterPanelOpen} onClose={() => setFilterPanelOpen(false)}
        members={(membersData || []).map((m: any) => ({ id: m.id, firstName: m.firstName }))}
        initial={advancedFilters}
        onApply={(filters) => {
          const f: Record<string, string> = {};
          if (filters.status) f.status = filters.status;
          if (filters.priority) f.priority = filters.priority;
          if (filters.assigneeId) f.assigneeId = filters.assigneeId;
          if (filters.sortBy) f.sortBy = filters.sortBy;
          setAdvancedFilters(f);
        }} />
    </div>
  );
}
