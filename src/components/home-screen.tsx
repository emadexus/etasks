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
  { key: "all",       labelKey: "all" as const,       color: "#6366f1", icon: "grid" as const },
  { key: "inbox",     labelKey: "inbox" as const,     color: "#fb923c", icon: "inbox" as const },
  { key: "today",     labelKey: "today" as const,     color: "#34d399", icon: "today" as const },
  { key: "tomorrow",  labelKey: "tomorrow" as const,  color: "#f87171", icon: "sunrise" as const },
  { key: "next7days", labelKey: "next7days" as const, color: "#6366f1", icon: "calendar" as const },
  { key: "completed", labelKey: "completed" as const, color: "#34d399", icon: "check" as const },
  // "archived" hidden from home — accessible only via task-detail sheet
];

function FilterIcon({ color, icon }: { color: string; icon: string }) {
  const size = 30;
  const svgProps = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "#fff", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  const renderIcon = () => {
    switch (icon) {
      case "grid":
        // 4 squares in a 2×2 grid
        return (
          <svg {...svgProps}>
            <rect x="1" y="1" width="5.5" height="5.5" rx="1.2" />
            <rect x="9.5" y="1" width="5.5" height="5.5" rx="1.2" />
            <rect x="1" y="9.5" width="5.5" height="5.5" rx="1.2" />
            <rect x="9.5" y="9.5" width="5.5" height="5.5" rx="1.2" />
          </svg>
        );
      case "inbox":
        // Tray with arrow down
        return (
          <svg {...svgProps}>
            <path d="M8 2v7" />
            <path d="M5.5 6.5L8 9l2.5-2.5" />
            <path d="M1.5 10h3L6 12.5h4L11.5 10h3V13.5a1 1 0 01-1 1h-11a1 1 0 01-1-1V10z" />
          </svg>
        );
      case "today":
        // Dynamic day number
        return (
          <span className="text-[13px] font-bold text-white" style={{ lineHeight: 1 }}>
            {new Date().getDate()}
          </span>
        );
      case "sunrise":
        // Sun rising above horizon
        return (
          <svg {...svgProps}>
            <path d="M2 12h12" />
            <path d="M4 10a4 4 0 018 0" />
            <path d="M8 2v2" />
            <path d="M3.5 5L5 6.5" />
            <path d="M12.5 5L11 6.5" />
          </svg>
        );
      case "calendar":
        // Mini calendar with header bar and dots
        return (
          <svg {...svgProps}>
            <rect x="1.5" y="2.5" width="13" height="12" rx="1.5" />
            <path d="M1.5 6h13" />
            <path d="M5 1v3" />
            <path d="M11 1v3" />
            <circle cx="5" cy="9" r="0.8" fill="#fff" stroke="none" />
            <circle cx="8" cy="9" r="0.8" fill="#fff" stroke="none" />
            <circle cx="11" cy="9" r="0.8" fill="#fff" stroke="none" />
            <circle cx="5" cy="12" r="0.8" fill="#fff" stroke="none" />
            <circle cx="8" cy="12" r="0.8" fill="#fff" stroke="none" />
          </svg>
        );
      case "check":
        // Circle with checkmark
        return (
          <svg {...svgProps}>
            <circle cx="8" cy="8" r="6.5" />
            <path d="M5.5 8l2 2 3.5-4" />
          </svg>
        );
      case "archive":
        // Box with lid
        return (
          <svg {...svgProps}>
            <rect x="1" y="1.5" width="14" height="3.5" rx="1" />
            <path d="M2.5 5v8.5a1.5 1.5 0 001.5 1.5h8a1.5 1.5 0 001.5-1.5V5" />
            <path d="M6.5 8.5h3" />
          </svg>
        );
      default:
        return <span className="text-[13px] font-bold text-white">?</span>;
    }
  };

  return (
    <div
      className="flex items-center justify-center rounded-[8px]"
      style={{ background: color, width: size, height: size }}
    >
      {renderIcon()}
    </div>
  );
}

export function HomeScreen() {
  const { ready, openTaskId, startBoardChatId, userId } = useTelegram();
  const { data: home, error: homeError } = useHome();
  const { data: deepLinkTask } = useTaskDetail(openTaskId);

  const [view, setView] = useState<ViewState>({ type: "home" });
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);

  const user = home?.user;
  const counts = home?.counts;
  const boards = home?.boards;
  const projectsList = home?.projects;

  // Deep link: open specific board via startapp=chatn...
  useEffect(() => {
    if (deepLinkHandled || !startBoardChatId || !boards) return;
    if (view.type !== "home") return;

    const board = (boards as any[]).find((b: any) => b.chatId === startBoardChatId);
    if (board) {
      setView({ type: "board", chatId: board.chatId, label: board.name });
      setDeepLinkHandled(true);
    }
  }, [startBoardChatId, boards, deepLinkHandled, view.type]);

  // Deep link: open specific task
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

  // Only show loading if we have NO cached data and auth isn't ready yet
  if (!home && !ready) {
    return (
      <div className="flex h-full items-center justify-center">
        <p style={{ color: "var(--text-muted)" }}>{t("loading")}</p>
      </div>
    );
  }

  // Access denied: only show after auth is ready AND fetch actually failed (not just loading)
  if (homeError && ready && !home) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 text-[64px]">🏔️</div>
        <h1 className="mb-2 text-[20px] font-bold" style={{ color: "var(--text-primary)" }}>
          eTask / Yeti
        </h1>
        <p className="mb-6 text-[14px]" style={{ color: "var(--text-muted)" }}>
          {t("loading") === "Загрузка..."
            ? "У вас нет доступа к этому приложению. Обратитесь к администратору."
            : "You don't have access to this app. Contact the admin to request access."}
        </p>
        <a
          href="https://t.me/emadex"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold text-white"
          style={{ background: "var(--accent-purple)" }}
        >
          @emadex
        </a>
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
    <div className="app-scroll-container mx-auto max-w-lg px-4 pb-24 pt-6">
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

      {/* ── Widget cards ── */}
      {counts && (
        <div className="mb-4 flex gap-2.5">
          <button
            className="flex flex-1 flex-col rounded-xl px-3.5 py-3 transition-colors active:bg-white/5"
            style={{ background: "rgba(52, 211, 153, 0.08)", border: "1px solid rgba(52, 211, 153, 0.15)" }}
            onClick={() => setView({ type: "filter", filter: "today", label: t("today") })}
          >
            <span className="text-[22px] font-bold" style={{ color: "var(--accent-green)" }}>
              {counts.today ?? 0}
            </span>
            <span className="text-[12px] font-medium" style={{ color: "var(--accent-green)" }}>
              {t("today")}
            </span>
          </button>
          <button
            className="flex flex-1 flex-col rounded-xl px-3.5 py-3 transition-colors active:bg-white/5"
            style={{ background: "rgba(251, 146, 60, 0.08)", border: "1px solid rgba(251, 146, 60, 0.15)" }}
            onClick={() => setView({ type: "filter", filter: "inbox", label: t("inbox") })}
          >
            <span className="text-[22px] font-bold" style={{ color: "var(--accent-orange)" }}>
              {counts.inbox ?? 0}
            </span>
            <span className="text-[12px] font-medium" style={{ color: "var(--accent-orange)" }}>
              {t("inbox")}
            </span>
          </button>
          {(counts.all - counts.today - counts.inbox) > 0 && (
            <button
              className="flex flex-1 flex-col rounded-xl px-3.5 py-3 transition-colors active:bg-white/5"
              style={{ background: "rgba(99, 102, 241, 0.08)", border: "1px solid rgba(99, 102, 241, 0.15)" }}
              onClick={() => setView({ type: "filter", filter: "all", label: t("all") })}
            >
              <span className="text-[22px] font-bold" style={{ color: "var(--accent-blue)" }}>
                {counts.all ?? 0}
              </span>
              <span className="text-[12px] font-medium" style={{ color: "var(--accent-blue)" }}>
                {t("all")}
              </span>
            </button>
          )}
        </div>
      )}

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
            <FilterIcon color={f.color} icon={f.icon} />
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
              {b.photoUrl ? (
                <img
                  src={b.photoUrl}
                  alt=""
                  className="h-[30px] w-[30px] rounded-full object-cover"
                />
              ) : (
                <div
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ background: "var(--accent-blue)", color: "#fff" }}
                >
                  {b.name[0].toUpperCase()}
                </div>
              )}
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
