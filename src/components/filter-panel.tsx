"use client";

import { useState } from "react";

interface FilterPanelProps {
  open: boolean;
  onClose: () => void;
  members: { id: string; firstName: string }[];
  onApply: (filters: { status?: string; priority?: string; assigneeId?: string; sortBy?: string }) => void;
  initial: Record<string, string>;
}

function ChipGroup({ label, options, selected, onSelect }: {
  label: string;
  options: { key: string; label: string }[];
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>{label}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.key} className="rounded-lg px-3 py-1.5 text-[12px] transition-colors"
            style={{
              background: selected === o.key ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
              color: selected === o.key ? "var(--accent-blue)" : "var(--text-secondary)",
            }}
            onClick={() => onSelect(o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterPanel({ open, onClose, members, onApply, initial }: FilterPanelProps) {
  const [status, setStatus] = useState(initial.status || "all");
  const [priority, setPriority] = useState(initial.priority || "all");
  const [assigneeId, setAssigneeId] = useState(initial.assigneeId || "all");
  const [sortBy, setSortBy] = useState(initial.sortBy || "newest");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "var(--bg-primary)" }}>
      <div className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <span className="text-[17px] font-semibold">Filters</span>
          <button className="text-[12px]" style={{ color: "var(--accent-blue)" }}
            onClick={() => { setStatus("all"); setPriority("all"); setAssigneeId("all"); setSortBy("newest"); }}>
            Reset
          </button>
        </div>
        <ChipGroup label="Status" options={[
          { key: "all", label: "All" }, { key: "todo", label: "To do" },
          { key: "in_progress", label: "In progress" }, { key: "done", label: "Done" },
        ]} selected={status} onSelect={setStatus} />
        <ChipGroup label="Priority" options={[
          { key: "all", label: "All" }, { key: "high", label: "High" },
          { key: "medium", label: "Medium" }, { key: "low", label: "Low" },
        ]} selected={priority} onSelect={setPriority} />
        <ChipGroup label="Assignee" options={[
          { key: "all", label: "All" },
          ...members.map((m) => ({ key: m.id, label: m.firstName })),
        ]} selected={assigneeId} onSelect={setAssigneeId} />
        <ChipGroup label="Sort by" options={[
          { key: "newest", label: "Newest" }, { key: "deadline", label: "Deadline" },
          { key: "priority", label: "Priority" },
        ]} selected={sortBy} onSelect={setSortBy} />
        <button className="mt-5 w-full rounded-[10px] py-3 text-[13px] font-medium text-white"
          style={{ background: "var(--accent-blue)" }}
          onClick={() => {
            onApply({
              status: status === "all" ? undefined : status,
              priority: priority === "all" ? undefined : priority,
              assigneeId: assigneeId === "all" ? undefined : assigneeId,
              sortBy,
            });
            onClose();
          }}>
          Apply Filters
        </button>
        <button className="mt-2 w-full py-2 text-[12px]" style={{ color: "var(--text-muted)" }} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
