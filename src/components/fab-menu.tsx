"use client";

interface FabMenuProps {
  onNewTask: () => void;
}

export function FabMenu({ onNewTask }: FabMenuProps) {
  return (
    <button
      className="fixed bottom-5 right-5 z-[80] flex h-[44px] w-[44px] items-center justify-center rounded-full shadow-lg transition-all active:scale-95"
      style={{ background: "var(--accent-purple)" }}
      onClick={onNewTask}
    >
      <span className="text-[24px] font-light leading-none text-white">+</span>
    </button>
  );
}
