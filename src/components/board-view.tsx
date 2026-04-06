"use client";

import { useState, useEffect } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { useTasks, useMembers, useTaskActions, useBoards, useTaskDetail } from "@/hooks/use-board";
import { TaskCard } from "./task-card";
import { QuickAdd } from "./quick-add";
import { FilterChips } from "./filter-chips";
import { TaskDetailSheet } from "./task-detail-sheet";

function BoardPicker({ onSelect }: { onSelect: (chatId: string) => void }) {
  const { data: boards, isLoading } = useBoards();

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
            className="flex items-center gap-3 rounded-xl border p-4 text-left transition-all active:scale-[0.98]"
            style={{ background: "var(--bg-card)", borderColor: "var(--border-card)" }}
            onClick={() => onSelect(board.chatId)}
          >
            {board.photoUrl ? (
              <img src={board.photoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ background: "var(--accent-blue)", color: "#fff" }}
              >
                {board.name[0].toUpperCase()}
              </div>
            )}
            <div className="text-[14px] font-medium">{board.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function BoardView() {
  const { chatId: initialChatId, userId, openTaskId, ready } = useTelegram();

  // "showBoardPicker" explicitly controls whether we show the picker
  const [showBoardPicker, setShowBoardPicker] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState("all");
  const [advancedFilters, setAdvancedFilters] = useState<Record<string, string>>({});

  // Resolve deep link: task ID → find board chatId
  const { data: deepLinkTask } = useTaskDetail(openTaskId);
  const { data: boardsList } = useBoards();

  useEffect(() => {
    if (!openTaskId || selectedChatId) return;
    if (!deepLinkTask?.task || !boardsList) return;
    const boardId = deepLinkTask.task.boardId;
    const board = (boardsList as any[]).find((b: any) => b.id === boardId);
    if (board) {
      setSelectedChatId(board.chatId);
      setSelectedTaskId(openTaskId);
    }
  }, [openTaskId, deepLinkTask, boardsList, selectedChatId]);

  const chatId = selectedChatId || initialChatId;

  const apiFilters: Record<string, string> = { ...advancedFilters };
  if (quickFilter === "todo") apiFilters.status = "todo";
  if (quickFilter === "in_progress") apiFilters.status = "in_progress";
  if (quickFilter === "done") apiFilters.status = "done";

  const { data: tasksData, isLoading } = useTasks(chatId && !showBoardPicker ? chatId : null, apiFilters);
  const { data: membersData } = useMembers(chatId && !showBoardPicker ? chatId : null);
  const { createTask, updateTask } = useTaskActions(chatId);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>Loading...</p>
      </div>
    );
  }

  // Show board picker if no chatId OR user explicitly navigated to it
  if (!chatId || showBoardPicker) {
    return (
      <BoardPicker
        onSelect={(id) => {
          setSelectedChatId(id);
          setShowBoardPicker(false);
        }}
      />
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
        <div className="flex items-center gap-3">
          <div>
            <div className="text-[17px] font-semibold tracking-tight">{boardName}</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {memberCount} member{memberCount !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
        {/* Burger → board picker */}
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[14px]"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => setShowBoardPicker(true)}
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
    </div>
  );
}
