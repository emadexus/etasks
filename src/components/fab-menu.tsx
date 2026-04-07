"use client";

import { useState } from "react";
import { useProjectActions } from "@/hooks/use-board";
import { t } from "@/lib/i18n";

interface FabMenuProps {
  onNewTask: () => void;
  onNewProject: () => void;
  projectCount: number;
  projectLimit: number;
}

export function FabMenu({ onNewTask, onNewProject, projectCount, projectLimit }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const [showProjectInput, setShowProjectInput] = useState(false);
  const [projectName, setProjectName] = useState("");
  const { createProject } = useProjectActions();

  const handleNewProject = async () => {
    if (projectCount >= projectLimit) return;
    if (showProjectInput) {
      if (projectName.trim()) {
        await createProject({ name: projectName.trim() });
        setProjectName("");
        setShowProjectInput(false);
        setOpen(false);
        onNewProject();
      }
    } else {
      setShowProjectInput(true);
    }
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[70] bg-black/50"
          onClick={() => { setOpen(false); setShowProjectInput(false); }}
        />
      )}

      {open && (
        <div className="fixed bottom-20 right-5 z-[80] flex w-[280px] flex-col gap-1.5">
          <button
            className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl transition-all active:scale-[0.97]"
            style={{ background: "var(--bg-secondary)" }}
            onClick={() => { setOpen(false); onNewTask(); }}
          >
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-[13px]"
              style={{ background: "var(--accent-green)", color: "#fff" }}>
              ✎
            </div>
            <div className="text-left">
              <div className="text-[13px] font-medium">{t("newTask")}</div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                {t("newTaskDesc")}
              </div>
            </div>
          </button>

          <button
            className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl transition-all active:scale-[0.97]"
            style={{ background: "var(--bg-secondary)" }}
            onClick={() => setOpen(false)}
          >
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-[13px]"
              style={{ background: "var(--accent-blue)", color: "#fff" }}>
              ⊕
            </div>
            <div className="text-left">
              <div className="text-[13px] font-medium">{t("addToGroupChatShort")}</div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                {t("addToGroupChatDescShort")}
              </div>
            </div>
          </button>

          <button
            className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl transition-all active:scale-[0.97]"
            style={{ background: "var(--bg-secondary)" }}
            onClick={handleNewProject}
          >
            <div className="flex h-[28px] w-[28px] items-center justify-center rounded-[7px] text-[13px]"
              style={{ background: "var(--accent-purple)", color: "#fff" }}>
              ▤
            </div>
            <div className="flex-1 text-left">
              {showProjectInput ? (
                <input
                  autoFocus
                  className="w-full bg-transparent text-[13px] font-medium outline-none"
                  placeholder={t("projectNamePlaceholder")}
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewProject()}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="text-[13px] font-medium">{t("newProject")}</div>
                  <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                    {t("newProjectDesc")}
                  </div>
                </>
              )}
            </div>
            <span className="text-[11px] tabular-nums" style={{ color: "var(--text-dim)" }}>
              {projectCount}/{projectLimit}
            </span>
          </button>
        </div>
      )}

      <button
        className="fixed bottom-5 right-5 z-[80] flex h-[46px] items-center gap-1.5 rounded-full px-5 shadow-lg transition-all active:scale-95"
        style={{ background: "var(--accent-purple)" }}
        onClick={() => { setOpen(!open); setShowProjectInput(false); }}
      >
        <span
          className="text-[20px] font-light text-white transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
        {!open && (
          <span className="text-[13px] font-semibold text-white">
            {t("newTask")}
          </span>
        )}
      </button>
    </>
  );
}
