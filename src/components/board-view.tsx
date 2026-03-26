"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { useTelegram } from "@/components/telegram-provider";
import { useTasks, useMembers, useTaskActions, useBoards, useTaskDetail } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { FilterChips } from "./filter-chips";
import { FilterPanel } from "./filter-panel";
import { TaskDetailSheet } from "./task-detail-sheet";

function BoardPicker({ onSelect }: { onSelect: (chatId: string) => void }) {
  const { initData } = useTelegram();
  const fetcher = async (url: string) => {
    const res = await fetch(url, {
      headers: initData ? { "x-telegram-init-data": initData } : {},
    });
    if (!res.ok) return [];
    return res.json();
  };
  const { data: boards, isLoading } = useSWR("/api/boards", fetcher);

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <div className="mb-6">
        <div className="text-[20px] font-semibold tracking-tight">etasks</div>
        <div className="mt-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
          Your task boards
        </div>
      </div>

      {isLoading && (
        <p className="py-8 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>Loading boards...</p>
      )}

      {!isLoading && (!boards || boards.length === 0) && (
        <div className="py-12 text-center">
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>No boards yet.</p>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-dim)" }}>
            Add @e_task_bot to a Telegram group to create a board.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(boards || []).map((board: any) => (
          <button
            key={board.id}
            className="rounded-xl border p-4 text-left transition-all active:scale-[0.98]"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
            onClick={() => onSelect(board.chatId)}
          >
            <div className="text-[14px] font-medium">{board.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function useDeepLinkResolution(openTaskId: string | null) {
  const { data: taskData } = useTaskDetail(openTaskId);
  const { data: boardsList } = useBoards();
  const [resolved, setResolved] = useState<{ chatId: string; taskId: string } | null>(null);

  useEffect(() => {
    if (!openTaskId || resolved) return;
    if (!taskData?.task || !boardsList) return;
    const boardId = taskData.task.boardId;
    const board = (boardsList as any[]).find((b: any) => b.id === boardId);
    if (board) {
      setResolved({ chatId: board.chatId, taskId: openTaskId });
    }
  }, [openTaskId, taskData, boardsList, resolved]);

  return resolved;
}

export function BoardView() {
  const { chatId: initialChatId, userId, openTaskId, ready } = useTelegram();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const deepLink = useDeepLinkResolution(openTaskId);

  // When a deep link resolves, auto-select the chat and task
  useEffect(() => {
    if (deepLink && !selectedChatId) {
      setSelectedChatId(deepLink.chatId);
      setSelectedTaskId(deepLink.taskId);
    }
  }, [deepLink, selectedChatId]);

  const chatId = selectedChatId || initialChatId;
  const [quickFilter, setQuickFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({});
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);

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
    return <BoardPicker onSelect={setSelectedChatId} />;
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
        <div className="flex items-center gap-3">
          {selectedChatId && (
            <button
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px]"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              onClick={() => setSelectedChatId(null)}
            >
              &#8592;
            </button>
          )}
          <div>
            <div className="text-[17px] font-semibold tracking-tight">{boardName}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setSelectedChatId(null)}
          title="Switch board"
        >
          &#8801;
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
