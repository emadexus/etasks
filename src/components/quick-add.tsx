"use client";

import { useState, useRef } from "react";

interface QuickAddProps {
  onAdd: (title: string) => Promise<void>;
}

export function QuickAdd({ onAdd }: QuickAddProps) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    const title = value.trim();
    if (!title || loading) return;
    setLoading(true);
    try {
      await onAdd(title);
      setValue("");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div
      className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
      style={{ background: "var(--bg-card)" }}
    >
      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-[14px] font-bold transition-colors"
        style={{
          color: value.trim() ? "#fff" : "var(--text-dim)",
          background: value.trim() ? "var(--accent-green)" : "transparent",
          border: value.trim() ? "none" : "1.5px solid var(--text-dim)",
        }}
      >
        +
      </button>
      <input
        ref={inputRef}
        className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-[var(--text-dim)]"
        placeholder="Add task..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        disabled={loading}
      />
    </div>
  );
}
