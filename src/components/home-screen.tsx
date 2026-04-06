"use client";

import { useState, useEffect } from "react";
import { useTelegram } from "@/components/telegram-provider";
import { useHome, useTaskDetail } from "@/hooks/use-board";
import { TaskListView } from "./task-list-view";
import { FabMenu } from "./fab-menu";
import { t } from "@/lib/i18n";

type ViewState =
  | { type: "home" }
  | { type: "filter"; filter: string; label: string }
  | { type: "project"; projectId: string; label: string }
  | { type: "board"; chatId: string; label: string };

const smartFilters = [
  { key: "all",       labelKey: "all" as const,       color: "#5856d6", glyph: "●" },
  { key: "inbox",     labelKey: "inbox" as const,     color: "#ff9500", glyph: "▣" },
  { key: "today",     labelKey: "today" as const,     color: "#30d158", glyph: "6" },
  { key: "tomorrow",  labelKey: "tomorrow" as const,  color: "#ff453a", glyph: "◈" },
  { key: "next7days", labelKey: "next7days" as const, color: "#5856d6", glyph: "▦" },
  { key: "completed", labelKey: "completed" as const, color: "#30d158", glyph: "✓" },
];

function FilterIcon({ color, glyph }: { color: string; glyph: string }) {
  return (
    <div
      className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[13px] font-bold text-white"
      style={{ background: color }}
    >
      {glyph}
    </div>
  );
}

export function HomeScreen() {
  const { ready, openTaskId } = useTelegram();
  const { data: home } = useHome();
  const { data: deepLinkTask } = useTaskDetail(openTaskId);

  const [view, setView] = useState<ViewState>({ type: "home" });

  const user = home?.user;
  const counts = home?.counts;
  const boards = home?.boards;
  const projectsList = home?.projects;

  useEffect(() => {
    if (!openTaskId || !deepLinkTask?.task) return;
    if (view.type !== "home") return;

    const task = deepLinkTask.task;
    if (task.boardId && boards) {
      const board = (boards as any[]).find((b: any) => b.id === task.boardId);
      if (board) {
        setView({ type: "board", chatId: board.chatId, label: board.name });
      }
    } else if (task.projectId) {
      setView({ type: "project", projectId: task.projectId, label: t("project") });
    } else {
      setView({ type: "filter", filter: "inbox", label: t("inbox") });
    }
  }, [openTaskId, deepLinkTask, boards]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>{t("loading")}</p>
      </div>
    );
  }

  if (view.type !== "home") {
    return (
      <TaskListView
        context={view}
        openTaskId={openTaskId || undefined}
        onBack={() => setView({ type: "home" })}
      />
    );
  }

  const boardCount = boards?.length || 0;

  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pb-24 pt-4">
      {/* ── User header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold"
            style={{ background: "var(--accent-purple)", color: "#fff" }}
          >
            {(user?.firstName || "U")[0].toUpperCase()}
          </div>
          <span className="text-[15px] font-semibold">
            {user?.firstName || t("user")}{" "}
            <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
          </span>
        </div>
      </div>

      {/* ── Add to group chat ── */}
      <button
        className="mb-px flex w-full items-center gap-3 rounded-t-xl px-3.5 py-3"
        style={{ background: "var(--bg-card)" }}
      >
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[14px]"
          style={{ background: "var(--accent-green)", color: "#fff" }}
        >
          ＋
        </div>
        <div className="flex-1 text-left">
          <div className="text-[13px] font-medium">{t("addToGroupChat")}</div>
          <div className="text-[11px] leading-tight" style={{ color: "var(--text-muted)" }}>
            {t("addToGroupChatDesc")}
          </div>
        </div>
        <span className="text-[12px] tabular-nums" style={{ color: "var(--text-dim)" }}>
          {boardCount}/2
        </span>
      </button>

      {/* ── Add task ── */}
      <button
        className="mb-4 flex w-full items-center gap-3 rounded-b-xl border-t px-3.5 py-3"
        style={{ background: "var(--bg-card)", borderColor: "var(--border-separator)" }}
        onClick={() => setView({ type: "filter", filter: "inbox", label: t("inbox") })}
      >
        <div
          className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[16px] font-bold"
          style={{ color: "var(--accent-green)" }}
        >
          +
        </div>
        <span className="text-[13px] font-medium">{t("addTask")}</span>
      </button>

      {/* ── Smart filters ── */}
      <div className="mb-4 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
        {smartFilters.map((f, i) => (
          <button
            key={f.key}
            className="flex w-full items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-white/5"
            style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
            onClick={() => setView({ type: "filter", filter: f.key, label: t(f.labelKey) })}
          >
            <FilterIcon color={f.color} glyph={f.glyph} />
            <span className="flex-1 text-left text-[14px] font-medium">{t(f.labelKey)}</span>
            <span className="mr-1 text-[14px] tabular-nums" style={{ color: "var(--text-dim)" }}>
              {counts?.[f.key as keyof typeof counts] ?? 0}
            </span>
            <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
          </button>
        ))}
      </div>

      {/* ── Projects ── */}
      {projectsList && projectsList.length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
          {projectsList.map((p: any, i: number) => (
            <button
              key={p.id}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-white/5"
              style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
              onClick={() => setView({ type: "project", projectId: p.id, label: p.name })}
            >
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ background: p.color || "var(--accent-purple)", color: "#fff" }}
              >
                {p.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-left text-[14px] font-medium">{p.name}</span>
              <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Group Boards ── */}
      {boards && (boards as any[]).length > 0 && (
        <div className="mb-4 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
          {(boards as any[]).map((b: any, i: number) => (
            <button
              key={b.id}
              className="flex w-full items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-white/5"
              style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
              onClick={() => setView({ type: "board", chatId: b.chatId, label: b.name })}
            >
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-semibold"
                style={{ background: "var(--accent-blue)", color: "#fff" }}
              >
                {b.name[0].toUpperCase()}
              </div>
              <span className="flex-1 text-left text-[14px] font-medium">{b.name}</span>
              <span className="mr-1 text-[14px]" style={{ color: "var(--text-dim)" }}>⊞</span>
              <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
            </button>
          ))}
        </div>
      )}

      <FabMenu
        onNewTask={() => setView({ type: "filter", filter: "inbox", label: t("inbox") })}
        onNewProject={() => {}}
        projectCount={projectsList?.length || 0}
        projectLimit={3}
      />
    </div>
  );
}
