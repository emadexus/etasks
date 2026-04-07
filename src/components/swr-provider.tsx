"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

const CACHE_KEY = "etasks-swr-cache";

function localStorageProvider() {
  // In development, always start fresh to avoid stale auth issues
  if (process.env.NODE_ENV === "development") {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  // Load cached data from localStorage on init
  let map: Map<string, any>;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    map = stored ? new Map(JSON.parse(stored)) : new Map();
  } catch {
    map = new Map();
  }

  // Persist to localStorage on every write (debounced via proxy)
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const saveToStorage = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const entries = Array.from(map.entries()).filter(
          ([key]) => typeof key === "string" && key.startsWith("/api/")
        );
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
      } catch {
        // localStorage full or unavailable
      }
    }, 500);
  };

  // Wrap map.set to trigger saves
  const originalSet = map.set.bind(map);
  map.set = (key: string, value: any) => {
    const result = originalSet(key, value);
    saveToStorage();
    return result;
  };

  // Also save on beforeunload as fallback
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (saveTimer) clearTimeout(saveTimer);
      try {
        const entries = Array.from(map.entries()).filter(
          ([key]) => typeof key === "string" && key.startsWith("/api/")
        );
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
      } catch {}
    });
  }

  return map;
}

export function SWRProvider({ children }: { children: ReactNode }) {
  // In dev, skip localStorage cache entirely — avoids stale auth issues
  if (process.env.NODE_ENV === "development") {
    return <SWRConfig value={{}}>{children}</SWRConfig>;
  }
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      {children}
    </SWRConfig>
  );
}
