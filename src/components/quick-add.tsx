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
    <div className="flex items-center gap-2 rounded-[10px] border border-dashed px-3.5 py-2.5"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
      <span style={{ color: "var(--text-muted)" }}>+</span>
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
