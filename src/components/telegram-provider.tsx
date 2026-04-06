"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";

interface TelegramContext {
  initData: string | null;
  chatId: string | null;
  userId: string | null;
  openTaskId: string | null;
  ready: boolean;
}

const TgContext = createContext<TelegramContext>({
  initData: null,
  chatId: null,
  userId: null,
  openTaskId: null,
  ready: false,
});

export function useTelegram() {
  return useContext(TgContext);
}

export function TelegramProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<TelegramContext>({
    initData: null,
    chatId: null,
    userId: null,
    openTaskId: null,
    ready: false,
  });

  useEffect(() => {
    try {
      // Try to use Telegram WebApp global
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        const initDataRaw = tg.initData || null;
        let chatId = new URLSearchParams(window.location.search).get("chatId");
        let openTaskId: string | null = null;
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith("task")) {
          // Deep link to specific task: "task{uuid}"
          openTaskId = startParam.slice(4);
        } else if (startParam && startParam.startsWith("chat")) {
          // Decode: "chatn4929114614" -> "-4929114614"
          chatId = startParam.slice(4).replace("n", "-");
        } else if (startParam) {
          chatId = startParam;
        }
        const userId = tg.initDataUnsafe?.user?.id?.toString() || null;

        console.log("[TG] initData:", initDataRaw ? `${initDataRaw.slice(0, 50)}...` : "null");
        console.log("[TG] chatId:", chatId, "userId:", userId, "openTaskId:", openTaskId);
        setCtx({ initData: initDataRaw, chatId, userId, openTaskId, ready: true });
      } else {
        console.log("[TG] No Telegram WebApp global found — using dev fallback");
        // Dev fallback: use query params or defaults
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId") || "-4929114614";
        const userId = "247463948";
        setCtx({ initData: "dev", chatId, userId, openTaskId: null, ready: true });
      }
    } catch (e) {
      console.warn("Not in Telegram Mini App context:", e);
      const params = new URLSearchParams(window.location.search);
      const chatId = params.get("chatId") || "-4929114614";
      setCtx({ initData: "dev", chatId, userId: "247463948", openTaskId: null, ready: true });
    }
  }, []);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
