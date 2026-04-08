"use client";

import { useState, useRef } from "react";
import { t } from "@/lib/i18n";

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
      className="glass flex items-center gap-3 rounded-xl px-4 py-3"
      style={{
        border: "1px dashed rgba(139, 92, 246, 0.25)",
      }}
    >
      <button
        onClick={handleSubmit}
        disabled={loading || !value.trim()}
        className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-[14px] font-bold press-scale"
        style={{
          color: value.trim() ? "#fff" : "var(--accent-purple)",
          background: value.trim() ? "var(--accent-purple)" : "transparent",
          border: value.trim() ? "none" : "2px solid var(--accent-purple)",
          opacity: value.trim() ? 1 : 0.5,
        }}
      >
        +
      </button>
      <input
        ref={inputRef}
        className="flex-1 bg-transparent text-[13px] outline-none"
        style={{ color: "var(--text-primary)" }}
        placeholder={t("addTaskPlaceholder")}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        disabled={loading}
      />
    </div>
  );
}
