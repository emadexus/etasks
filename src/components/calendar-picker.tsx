"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";

interface CalendarPickerProps {
  dateDue: Date | null;
  datePlanned: Date | null;
  recurrenceRule: string | null;
  onAccept: (updates: Record<string, any>) => void;
  onCancel: () => void;
}

function getDays() { return [t("mo"), t("tu"), t("we"), t("th"), t("fr"), t("sa"), t("su")]; }

function getRecurrenceOptions() {
  return [
    { label: t("none"), value: null },
    { label: t("daily"), value: JSON.stringify({ type: "daily", interval: 1 }) },
    { label: t("weekly"), value: JSON.stringify({ type: "weekly", interval: 1 }) },
    { label: t("monthly"), value: JSON.stringify({ type: "monthly", interval: 1 }) },
    { label: t("yearly"), value: JSON.stringify({ type: "yearly", interval: 1 }) },
  ];
}

function sameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function CalendarPicker({ dateDue, datePlanned, recurrenceRule, onAccept, onCancel }: CalendarPickerProps) {
  const [activeTab, setActiveTab] = useState<"planned" | "due">("due");
  const activeDate = activeTab === "due" ? dateDue : datePlanned;

  const today = new Date();
  const [viewYear, setViewYear] = useState(activeDate?.getFullYear() || today.getFullYear());
  const [viewMonth, setViewMonth] = useState(activeDate?.getMonth() ?? today.getMonth());

  const [selectedDue, setSelectedDue] = useState<Date | null>(dateDue);
  const [selectedPlanned, setSelectedPlanned] = useState<Date | null>(datePlanned);
  const [time, setTime] = useState(() => {
    const d = activeDate || null;
    if (!d) return "";
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  });
  const [selectedRecurrence, setSelectedRecurrence] = useState(recurrenceRule || null);
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);

  const selectedDate = activeTab === "due" ? selectedDue : selectedPlanned;
  const setSelectedDate = activeTab === "due" ? setSelectedDue : setSelectedPlanned;

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfWeek(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const newDate = new Date(viewYear, viewMonth, day);
    if (selectedDate) newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    setSelectedDate(newDate);
  };

  const setQuickDate = (d: Date | null) => {
    setSelectedDate(d);
    if (d) { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }
  };

  const handleAccept = () => {
    const applyTime = (d: Date | null, timeStr: string): string | null => {
      if (!d) return null;
      const result = new Date(d);
      if (timeStr) { const [h, m] = timeStr.split(":").map(Number); result.setHours(h, m, 0, 0); }
      return result.toISOString();
    };

    const updates: Record<string, any> = {};
    updates.dateDue = applyTime(selectedDue, activeTab === "due" ? time : "");
    updates.datePlanned = applyTime(selectedPlanned, activeTab === "planned" ? time : "");
    updates.recurrenceRule = selectedRecurrence;

    onAccept(updates);
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const recurrenceLabel = (() => {
    if (!selectedRecurrence) return t("setSpecificTime");
    try {
      const r = JSON.parse(selectedRecurrence);
      const key = r.type as "daily" | "weekly" | "monthly" | "yearly";
      return t(key);
    } catch { return t("custom"); }
  })();

  const DAYS = getDays();
  const RECURRENCE_OPTIONS = getRecurrenceOptions();

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60">
      <div className="w-full max-w-lg rounded-t-2xl" style={{ background: "var(--bg-primary)" }}>
        {/* Tabs */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border-separator)" }}>
          {(["planned", "due"] as const).map((tab) => (
            <button
              key={tab}
              className="flex-1 py-3.5 text-center text-[13px] font-medium transition-opacity"
              style={{
                color: "var(--accent-purple)",
                opacity: activeTab === tab ? 1 : 0.4,
                borderBottom: activeTab === tab ? "2px solid var(--accent-purple)" : "2px solid transparent",
              }}
              onClick={() => setActiveTab(tab)}
            >
              {tab === "planned" ? t("datePlanned") : t("dateDue")}
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={prevMonth} className="px-2 text-[20px] font-light" style={{ color: "var(--accent-purple)" }}>‹</button>
          <span className="text-[14px] font-semibold">{monthName}</span>
          <button onClick={nextMonth} className="px-2 text-[20px] font-light" style={{ color: "var(--accent-purple)" }}>›</button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 px-5 pb-1">
          {DAYS.map(d => (
            <div key={d} className="py-1 text-center text-[11px] font-medium" style={{ color: "var(--text-dim)" }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 px-5 pb-4">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const cellDate = new Date(viewYear, viewMonth, day);
            const isToday = sameDay(cellDate, today);
            const isSelected = sameDay(cellDate, selectedDate);

            return (
              <button
                key={day}
                className="flex h-10 w-full items-center justify-center rounded-full text-[14px] transition-colors"
                style={{
                  background: isSelected ? "var(--accent-purple)" : "transparent",
                  color: isSelected ? "#fff" : isToday ? "var(--accent-purple)" : "var(--text-primary)",
                  fontWeight: isToday || isSelected ? 600 : 400,
                }}
                onClick={() => selectDay(day)}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 px-5 pb-4">
          {[
            { label: t("clear"), icon: "✕", action: () => setQuickDate(null) },
            { label: t("today"), icon: "◉", action: () => setQuickDate(today) },
            { label: t("tomorrow"), icon: "→", action: () => { const d = new Date(); d.setDate(d.getDate() + 1); setQuickDate(d); } },
          ].map((btn) => (
            <button
              key={btn.label}
              className="flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 transition-colors active:bg-white/5"
              style={{ background: "var(--bg-card)", color: "var(--accent-purple)" }}
              onClick={btn.action}
            >
              <span className="text-[16px]">{btn.icon}</span>
              <span className="text-[11px] font-medium">{btn.label}</span>
            </button>
          ))}
        </div>

        {/* Time / Notify / Repeat */}
        <div className="mx-5 overflow-hidden rounded-xl" style={{ background: "var(--bg-card)" }}>
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>◷</span>
              <span className="text-[14px]">{t("time")}</span>
            </div>
            <input type="time" className="rounded bg-transparent px-2 py-0.5 text-[14px] outline-none"
              style={{ color: "var(--text-primary)", colorScheme: "dark" }} value={time} onChange={(e) => setTime(e.target.value)} />
          </div>

          <div style={{ borderTop: "1px solid var(--border-separator)" }} />

          <div className="px-3.5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>↻</span>
                <span className="text-[14px]">{t("repeat")}</span>
              </div>
              <button className="text-[13px]"
                style={{ color: selectedRecurrence ? "var(--accent-purple)" : "var(--text-muted)" }}
                onClick={() => setShowRecurrencePicker(!showRecurrencePicker)}>
                {recurrenceLabel}
              </button>
            </div>

            {showRecurrencePicker && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button key={opt.label} className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
                    style={{
                      background: selectedRecurrence === opt.value ? "var(--accent-purple)" : "var(--bg-secondary)",
                      color: selectedRecurrence === opt.value ? "#fff" : "var(--text-secondary)",
                    }}
                    onClick={() => { setSelectedRecurrence(opt.value); setShowRecurrencePicker(false); }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-5">
          <button className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold transition-colors active:bg-white/5"
            style={{ color: "var(--accent-purple)" }} onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold transition-colors active:opacity-90"
            style={{ background: "var(--accent-purple)", color: "#fff" }} onClick={handleAccept}>
            {t("accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
