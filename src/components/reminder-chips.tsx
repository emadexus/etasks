"use client";

const PRESETS = ["1h", "6h", "12h", "24h", "48h", "3d", "7d", "30d"];

interface ReminderChipsProps {
  activeOffsets: string[];
  onToggle: (offset: string, enabled: boolean) => void;
}

export function ReminderChips({ activeOffsets, onToggle }: ReminderChipsProps) {
  return (
    <div>
      <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>Reminders</div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = activeOffsets.includes(p);
          return (
            <button key={p} className="rounded-[5px] px-2 py-0.5 text-[10px] transition-colors"
              style={{
                background: active ? "var(--accent-blue-bg)" : "rgba(255,255,255,0.03)",
                color: active ? "var(--accent-blue)" : "var(--text-muted)",
              }}
              onClick={() => onToggle(p, !active)}>
              {p}
            </button>
          );
        })}
      </div>
    </div>
  );
}
