"use client";

import { t } from "@/lib/i18n";

const PRESETS = ["1h", "6h", "12h", "24h", "48h", "3d", "7d", "30d"];

interface ReminderChipsProps {
  activeOffsets: string[];
  onToggle: (offset: string, enabled: boolean) => void;
}

export function ReminderChips({ activeOffsets, onToggle }: ReminderChipsProps) {
  return (
    <div>
      <div className="mb-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>{t("reminders")}</div>
      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => {
          const active = activeOffsets.includes(p);
          return (
            <button key={p} className="rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors"
              style={{
                background: active ? "var(--accent-purple-bg)" : "var(--bg-card)",
                color: active ? "var(--accent-purple)" : "var(--text-muted)",
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
