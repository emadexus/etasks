"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";

function localStorageProvider() {
  const CACHE_KEY = "etasks-swr-cache";

  // Load cached data from localStorage on init
  let map: Map<string, any>;
  try {
    const stored = localStorage.getItem(CACHE_KEY);
    map = stored ? new Map(JSON.parse(stored)) : new Map();
  } catch {
    map = new Map();
  }

  // Save to localStorage before unload
  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      try {
        // Only cache API responses, skip SWR internal keys
        const entries = Array.from(map.entries()).filter(
          ([key]) => typeof key === "string" && key.startsWith("/api/")
        );
        localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
      } catch {
        // localStorage full or unavailable — silently ignore
      }
    });
  }

  return map;
}

export function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig value={{ provider: localStorageProvider }}>
      {children}
    </SWRConfig>
  );
}
