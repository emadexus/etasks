"use client";

import { useState } from "react";

interface CalendarPickerProps {
  dateDue: Date | null;
  datePlanned: Date | null;
  notifyAt: Date | null;
  recurrenceRule: string | null;
  onAccept: (updates: Record<string, any>) => void;
  onCancel: () => void;
}

const DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const RECURRENCE_OPTIONS = [
  { label: "None", value: null },
  { label: "Daily", value: JSON.stringify({ type: "daily", interval: 1 }) },
  { label: "Weekly", value: JSON.stringify({ type: "weekly", interval: 1 }) },
  { label: "Monthly", value: JSON.stringify({ type: "monthly", interval: 1 }) },
  { label: "Yearly", value: JSON.stringify({ type: "yearly", interval: 1 }) },
];

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

export function CalendarPicker({ dateDue, datePlanned, notifyAt, recurrenceRule, onAccept, onCancel }: CalendarPickerProps) {
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
  const [notify, setNotify] = useState(!!notifyAt);
  const [notifyTime, setNotifyTime] = useState(() => {
    if (!notifyAt) return "";
    return `${notifyAt.getHours().toString().padStart(2, "0")}:${notifyAt.getMinutes().toString().padStart(2, "0")}`;
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
    if (selectedDate) {
      newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
    }
    setSelectedDate(newDate);
  };

  const setQuickDate = (d: Date | null) => {
    setSelectedDate(d);
    if (d) {
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  };

  const handleAccept = () => {
    const applyTime = (d: Date | null, t: string): string | null => {
      if (!d) return null;
      const result = new Date(d);
      if (t) {
        const [h, m] = t.split(":").map(Number);
        result.setHours(h, m, 0, 0);
      }
      return result.toISOString();
    };

    const updates: Record<string, any> = {};
    updates.dateDue = applyTime(selectedDue, activeTab === "due" ? time : "");
    updates.datePlanned = applyTime(selectedPlanned, activeTab === "planned" ? time : "");
    updates.recurrenceRule = selectedRecurrence;

    if (notify && notifyTime && (selectedDue || selectedPlanned)) {
      const baseDate = selectedDue || selectedPlanned!;
      const notifyDate = new Date(baseDate);
      const [h, m] = notifyTime.split(":").map(Number);
      notifyDate.setHours(h, m, 0, 0);
      updates.notifyAt = notifyDate.toISOString();
    } else {
      updates.notifyAt = null;
    }

    onAccept(updates);
  };

  const monthName = new Date(viewYear, viewMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const recurrenceLabel = (() => {
    if (!selectedRecurrence) return "Set specific time";
    try {
      const r = JSON.parse(selectedRecurrence);
      return r.type.charAt(0).toUpperCase() + r.type.slice(1);
    } catch { return "Custom"; }
  })();

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60">
      <div
        className="w-full max-w-lg rounded-t-2xl"
        style={{ background: "var(--bg-primary)" }}
      >
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
              {tab === "planned" ? "Date planned" : "Date due"}
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
            { label: "Clear", icon: "✕", action: () => setQuickDate(null) },
            { label: "Today", icon: "◉", action: () => setQuickDate(today) },
            { label: "Tomorrow", icon: "→", action: () => { const t = new Date(); t.setDate(t.getDate() + 1); setQuickDate(t); } },
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
          {/* Time */}
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>◷</span>
              <span className="text-[14px]">Time</span>
            </div>
            <input
              type="time"
              className="rounded bg-transparent px-2 py-0.5 text-[14px] outline-none"
              style={{ color: "var(--text-primary)", colorScheme: "dark" }}
              value={time}
              onChange={(e) => setTime(e.target.value)}
              placeholder="--:--"
            />
          </div>

          <div style={{ borderTop: "1px solid var(--border-separator)" }} />

          {/* Notify */}
          <div className="flex items-center justify-between px-3.5 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>⏰</span>
              <span className="text-[14px]">Notify</span>
            </div>
            {notify ? (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  className="rounded bg-transparent px-2 py-0.5 text-[14px] outline-none"
                  style={{ color: "var(--text-primary)", colorScheme: "dark" }}
                  value={notifyTime}
                  onChange={(e) => setNotifyTime(e.target.value)}
                />
                <button
                  className="text-[12px]"
                  style={{ color: "var(--text-dim)" }}
                  onClick={() => { setNotify(false); setNotifyTime(""); }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                className="text-[13px]"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setNotify(true)}
              >
                Set specific time
              </button>
            )}
          </div>

          <div style={{ borderTop: "1px solid var(--border-separator)" }} />

          {/* Repeat */}
          <div className="px-3.5 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[15px]" style={{ color: "var(--text-muted)" }}>↻</span>
                <span className="text-[14px]">Repeat</span>
              </div>
              <button
                className="text-[13px]"
                style={{ color: selectedRecurrence ? "var(--accent-purple)" : "var(--text-muted)" }}
                onClick={() => setShowRecurrencePicker(!showRecurrencePicker)}
              >
                {recurrenceLabel}
              </button>
            </div>

            {showRecurrencePicker && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {RECURRENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    className="rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors"
                    style={{
                      background: selectedRecurrence === opt.value ? "var(--accent-purple)" : "var(--bg-secondary)",
                      color: selectedRecurrence === opt.value ? "#fff" : "var(--text-secondary)",
                    }}
                    onClick={() => { setSelectedRecurrence(opt.value); setShowRecurrencePicker(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 py-5">
          <button
            className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold transition-colors active:bg-white/5"
            style={{ color: "var(--accent-purple)" }}
            onClick={onCancel}
          >
            CANCEL
          </button>
          <button
            className="flex-1 rounded-xl py-3 text-center text-[14px] font-semibold transition-colors active:opacity-90"
            style={{ background: "var(--accent-purple)", color: "#fff" }}
            onClick={handleAccept}
          >
            ACCEPT
          </button>
        </div>
      </div>
    </div>
  );
}
