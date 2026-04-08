"use client";

import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  visible: boolean;
}

interface ToastContextType {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    // Add hidden, then make visible on next frame for CSS transition
    setToasts((prev) => [...prev, { id, message, visible: false }]);
    requestAnimationFrame(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: true } : t));
    });
    // Start exit
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => t.id === id ? { ...t, visible: false } : t));
    }, 2000);
    // Remove from DOM
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2300);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto rounded-full px-5 py-2.5 text-[13px] font-medium text-white"
            style={{
              background: "rgba(30, 26, 46, 0.85)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              transition: "transform 300ms var(--ease-out), opacity 300ms var(--ease-out)",
              transform: toast.visible ? "translateY(0) scale(1)" : "translateY(12px) scale(0.95)",
              opacity: toast.visible ? 1 : 0,
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
