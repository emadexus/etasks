"use client";

import { useState } from "react";
import { useProjectActions } from "@/hooks/use-board";

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
          {/* New task */}
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
              <div className="text-[13px] font-medium">New task</div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                Quickly add a task to "Incoming" or to a custom project
              </div>
            </div>
          </button>

          {/* Add to group chat */}
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
              <div className="text-[13px] font-medium">Add to group chat</div>
              <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                A collaborative project via Telegram group
              </div>
            </div>
          </button>

          {/* New project */}
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
                  placeholder="Project name..."
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNewProject()}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <div className="text-[13px] font-medium">New project</div>
                  <div className="text-[10px] leading-tight" style={{ color: "var(--text-muted)" }}>
                    Create a collection for tasks
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

      {/* FAB */}
      <button
        className="fixed bottom-5 right-5 z-[80] flex h-[52px] w-[52px] items-center justify-center rounded-full shadow-lg transition-all active:scale-90"
        style={{ background: "var(--accent-purple)" }}
        onClick={() => { setOpen(!open); setShowProjectInput(false); }}
      >
        <span
          className="text-[24px] font-light text-white transition-transform duration-200"
          style={{ transform: open ? "rotate(45deg)" : "none" }}
        >
          +
        </span>
      </button>
    </>
  );
}
