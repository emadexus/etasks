"use client";

import { useState } from "react";
import { useFilteredTasks, useTasks, useMembers, useTaskActions } from "@/hooks/use-board";
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

export function TaskListView({ context, openTaskId, onBack }: TaskListViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(openTaskId || null);

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

  const activeTasks = taskItems.filter((t: any) => t.task.status !== "done");
  const doneTasks = taskItems.filter((t: any) => t.task.status === "done");
  const sortedTasks = [...activeTasks, ...doneTasks];

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-8 pt-3">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[18px] transition-colors active:bg-white/5"
          style={{ color: "var(--accent-purple)" }}
          onClick={onBack}
        >
          ‹
        </button>
        <div className="flex-1">
          <div className="text-[17px] font-semibold tracking-tight">{context.label}</div>
          {isBoard && membersData && (
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              {membersData.length} member{membersData.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>

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
            No tasks yet. Add one above.
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
