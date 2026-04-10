"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTelegram } from "@/components/telegram-provider";
import { useHome, useTaskDetail, useUserActions, useBoardActions } from "@/hooks/use-board";
import { TaskDetailSheet } from "./task-detail-sheet";
import { setLocale } from "@/lib/i18n";
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
  { key: "archived",  labelKey: "archived" as const,  color: "#6e6879", icon: "archive" as const },
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

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "ru", label: "Русский", flag: "🇷🇺" },
];

function SettingsSheet({ user, boards, onClose }: {
  user: any;
  boards: any[];
  onClose: () => void;
}) {
  const { updateLanguage } = useUserActions();
  const { updateBoardLanguage } = useBoardActions();
  const [userLang, setUserLang] = useState(user?.language || "en");

  const [boardLangs, setBoardLangs] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const b of boards) map[b.id] = b.language || "en";
    return map;
  });

  const handleUserLang = async (lang: string) => {
    setUserLang(lang);
    setLocale(lang);
    await updateLanguage(lang);
  };

  const handleBoardLang = async (boardId: string, lang: string) => {
    setBoardLangs(prev => ({ ...prev, [boardId]: lang }));
    await updateBoardLanguage(boardId, lang);
  };

  return createPortal(
    <>
      <div className="sheet-overlay-enter fixed inset-0 z-[100] bg-black/40" onClick={onClose} />
      <div
        className="sheet-enter glass-elevated fixed inset-x-0 bottom-0 z-[101] max-h-[80vh] overflow-y-auto rounded-t-2xl px-4 pb-8 pt-3"
        style={{ background: "rgba(30, 26, 46, 0.85)" }}
      >
        <div className="mx-auto mb-4 h-1 w-8 rounded-full" style={{ background: "var(--text-dim)" }} />

        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
          {userLang === "ru" ? "Язык приложения" : "App language"}
        </div>
        <div className="card-elevated glass mb-4 overflow-hidden rounded-xl">
          {LANGUAGES.map((l, i) => (
            <button
              key={l.code}
              className="flex w-full items-center gap-3 px-3.5 py-3 press-scale transition-colors"
              style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
              onClick={() => handleUserLang(l.code)}
            >
              <span className="text-[16px]">{l.flag}</span>
              <span className="flex-1 text-left text-[14px]" style={{ color: "var(--text-primary)" }}>{l.label}</span>
              {userLang === l.code && <span className="text-[16px]" style={{ color: "var(--accent-green)" }}>✓</span>}
            </button>
          ))}
        </div>

        {boards && boards.length > 0 && (
          <>
            <div className="mb-1 text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-dim)" }}>
              {userLang === "ru" ? "Язык уведомлений (группы)" : "Notification language (groups)"}
            </div>
            <div className="overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
              {boards.map((b: any, i: number) => (
                <div
                  key={b.id}
                  className="flex items-center gap-3 px-3.5 py-3"
                  style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
                >
                  <span className="flex-1 text-[14px]" style={{ color: "var(--text-primary)" }}>{b.name}</span>
                  <div className="flex gap-1">
                    {LANGUAGES.map((l) => (
                      <button
                        key={l.code}
                        className="rounded-lg px-2.5 py-1 text-[12px] font-medium transition-colors"
                        style={{
                          background: (boardLangs[b.id] || "en") === l.code ? "var(--accent-blue)" : "var(--bg-secondary)",
                          color: (boardLangs[b.id] || "en") === l.code ? "#fff" : "var(--text-muted)",
                        }}
                        onClick={() => handleBoardLang(b.id, l.code)}
                      >
                        {l.flag}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  );
}

export function HomeScreen() {
  const { ready, openTaskId, startBoardChatId } = useTelegram();
  const { data: home, error: homeError } = useHome();
  const { data: deepLinkTask } = useTaskDetail(openTaskId);

  const [view, setView] = useState<ViewState>({ type: "home" });
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [consumedTaskId, setConsumedTaskId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDraft, setShowDraft] = useState(false);

  const user = home?.user;
  const counts = home?.counts;
  const boards = home?.boards;
  const projectsList = home?.projects;

  // Apply user's saved language preference
  useEffect(() => {
    if (user?.language) {
      setLocale(user.language);
    }
  }, [user?.language]);

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
    if (deepLinkHandled || !openTaskId || !deepLinkTask?.task) return;
    if (view.type !== "home") return;

    setDeepLinkHandled(true);
    setConsumedTaskId(openTaskId);
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
        openTaskId={consumedTaskId || undefined}
        onBack={() => { setView({ type: "home" }); setConsumedTaskId(null); }}
      />
    );
  }

  const boardCount = boards?.length || 0;

  return (
    <div className="app-scroll-container mx-auto max-w-lg pb-24">
      {/* ── Gradient header zone ── */}
      <div
        className="px-5 pb-6 pt-8"
        style={{
          background: "linear-gradient(180deg, rgba(139,92,246,0.15) 0%, rgba(99,102,241,0.08) 50%, transparent 100%)",
        }}
      >
        <div className="mb-6 flex items-center justify-between">
          <button
            className="flex items-center gap-3.5 press-scale"
            onClick={() => setShowSettings(true)}
          >
            {/* Avatar with progress ring */}
            <div className="relative flex items-center justify-center" style={{ width: 48, height: 48 }}>
              <svg width="48" height="48" viewBox="0 0 48 48" className="absolute inset-0">
                <circle cx="24" cy="24" r="22" fill="none" stroke="rgba(139,92,246,0.12)" strokeWidth="2.5" />
                <circle
                  cx="24" cy="24" r="22"
                  fill="none"
                  stroke="var(--accent-green)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="progress-ring-circle"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - Math.min((counts?.completed ?? 0) / Math.max((counts?.all ?? 0) + (counts?.completed ?? 0), 1), 1))}`}
                />
              </svg>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold"
                style={{ background: "var(--accent-purple)", color: "#fff" }}
              >
                {(user?.firstName || "U")[0].toUpperCase()}
              </div>
            </div>
            <div className="text-[18px] font-bold tracking-tight">
              {(() => {
                const h = new Date().getHours();
                const greeting = h < 12 ? t("goodMorning") : h < 18 ? t("goodAfternoon") : t("goodEvening");
                return `${greeting}, ${user?.firstName || "—"}`;
              })()}
            </div>
          </button>
          <button
            className="press-scale flex h-9 w-9 items-center justify-center rounded-full text-[15px]"
            style={{ color: "var(--text-dim)", background: "var(--surface-1)" }}
            onClick={() => setShowSettings(true)}
          >
            ⚙
          </button>
        </div>

        {/* ── Widget cards — horizontal gradient cards ── */}
        {counts && (
          <div className="flex gap-3">
            <button
              className="flex flex-1 flex-col rounded-2xl px-4 py-3.5 press-scale"
              style={{
                background: "linear-gradient(135deg, rgba(52,211,153,0.18) 0%, rgba(52,211,153,0.06) 100%)",
                border: "1px solid rgba(52,211,153,0.15)",
              }}
              onClick={() => setView({ type: "filter", filter: "today", label: t("today") })}
            >
              <span className="text-[28px] font-bold leading-none" style={{ color: "var(--accent-green)" }}>
                {counts.today ?? 0}
              </span>
              <span className="mt-1 text-[12px] font-semibold" style={{ color: "rgba(52,211,153,0.8)" }}>
                {t("today")}
              </span>
            </button>
            <button
              className="flex flex-1 flex-col rounded-2xl px-4 py-3.5 press-scale"
              style={{
                background: "linear-gradient(135deg, rgba(251,146,60,0.18) 0%, rgba(251,146,60,0.06) 100%)",
                border: "1px solid rgba(251,146,60,0.15)",
              }}
              onClick={() => setView({ type: "filter", filter: "inbox", label: t("inbox") })}
            >
              <span className="text-[28px] font-bold leading-none" style={{ color: "var(--accent-orange)" }}>
                {counts.inbox ?? 0}
              </span>
              <span className="mt-1 text-[12px] font-semibold" style={{ color: "rgba(251,146,60,0.8)" }}>
                {t("inbox")}
              </span>
            </button>
            <button
              className="flex flex-1 flex-col rounded-2xl px-4 py-3.5 press-scale"
              style={{
                background: "linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0.06) 100%)",
                border: "1px solid rgba(99,102,241,0.15)",
              }}
              onClick={() => setView({ type: "filter", filter: "all", label: t("all") })}
            >
              <span className="text-[28px] font-bold leading-none" style={{ color: "var(--accent-blue)" }}>
                {counts.all ?? 0}
              </span>
              <span className="mt-1 text-[12px] font-semibold" style={{ color: "rgba(99,102,241,0.8)" }}>
                {t("all")}
              </span>
            </button>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsSheet
          user={user}
          boards={boards || []}
          onClose={() => setShowSettings(false)}
        />
      )}

      <div className="px-5">
        {/* ── Smart filters — remaining filters ── */}
        <div className="mb-6 overflow-hidden rounded-2xl" style={{ borderLeft: "2px solid var(--accent-purple)" }}>
          <div className="card-elevated glass overflow-hidden rounded-2xl">
            {smartFilters.filter(f => f.key !== "today" && f.key !== "inbox" && f.key !== "all")
            .map((f, i) => {
              const count = counts?.[f.key as keyof typeof counts] ?? 0;
              return (
                <button
                  key={f.key}
                  className="flex w-full items-center gap-4 px-4 py-3 press-scale"
                  style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
                  onClick={() => setView({ type: "filter", filter: f.key, label: t(f.labelKey) })}
                >
                  <FilterIcon color={f.color} icon={f.icon} />
                  <span className="flex-1 text-left text-[14px] font-medium">{t(f.labelKey)}</span>
                  <span className="text-[14px] tabular-nums font-semibold" style={{ color: count > 0 ? f.color : "var(--text-dim)" }}>
                    {count}
                  </span>
                  <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Projects ── */}
        {projectsList && projectsList.length > 0 && (
          <div className="mb-6">
            <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              {t("projects")}
            </div>
            <div style={{ borderLeft: "2px solid var(--accent-blue)" }}>
              <div className="card-elevated glass overflow-hidden rounded-2xl">
                {projectsList.map((p: any, i: number) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center gap-4 px-4 py-3.5 press-scale"
                    style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
                    onClick={() => setView({ type: "project", projectId: p.id, label: p.name })}
                  >
                    <div
                      className="flex h-[36px] w-[36px] items-center justify-center rounded-xl text-[14px] font-semibold"
                      style={{ background: p.color || "var(--accent-blue)", color: "#fff" }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 text-left text-[15px] font-medium">{p.name}</span>
                    <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Group Boards ── */}
        {boards && (boards as any[]).length > 0 && (
          <div className="mb-6">
            <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-dim)" }}>
              {t("groupBoards")}
            </div>
            <div style={{ borderLeft: "2px solid var(--accent-green)" }}>
              <div className="card-elevated glass overflow-hidden rounded-2xl">
                {(boards as any[]).map((b: any, i: number) => (
                  <button
                    key={b.id}
                    className="flex w-full items-center gap-4 px-4 py-3.5 press-scale"
                    style={i > 0 ? { borderTop: "1px solid var(--border-separator)" } : undefined}
                    onClick={() => setView({ type: "board", chatId: b.chatId, label: b.name })}
                  >
                    {b.photoUrl ? (
                      <img src={b.photoUrl} alt="" className="h-[36px] w-[36px] rounded-xl object-cover" />
                    ) : (
                      <div
                        className="flex h-[36px] w-[36px] items-center justify-center rounded-xl text-[13px] font-semibold"
                        style={{ background: "var(--accent-green)", color: "#fff" }}
                      >
                        {b.name[0].toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 text-left text-[15px] font-medium">{b.name}</span>
                    <span className="text-[13px]" style={{ color: "var(--text-dim)" }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <FabMenu onNewTask={() => setShowDraft(true)} />

      {showDraft && (
        <TaskDetailSheet
          taskId={null}
          chatId={null}
          onClose={() => setShowDraft(false)}
        />
      )}
    </div>
  );
}
