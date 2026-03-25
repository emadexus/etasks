"use client";

interface FilterChipsProps {
  active: string;
  onChange: (filter: string) => void;
}

const filters = [
  { key: "all", label: "All" },
  { key: "my", label: "My tasks" },
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function FilterChips({ active, onChange }: FilterChipsProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
      {filters.map((f) => (
        <button
          key={f.key}
          className="whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] transition-colors"
          style={{
            background: active === f.key ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
            color: active === f.key ? "var(--accent-blue)" : "var(--text-muted)",
          }}
          onClick={() => onChange(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
