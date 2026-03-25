"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";

interface TelegramContext {
  initData: string | null;
  chatId: string | null;
  userId: string | null;
  ready: boolean;
}

const TgContext = createContext<TelegramContext>({
  initData: null,
  chatId: null,
  userId: null,
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
    ready: false,
  });

  useEffect(() => {
    try {
      // Try to use Telegram WebApp global
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        const initDataRaw = tg.initData || null;
        const chatId = tg.initDataUnsafe?.start_param || new URLSearchParams(window.location.search).get("chatId");
        const userId = tg.initDataUnsafe?.user?.id?.toString() || null;

        setCtx({ initData: initDataRaw, chatId, userId, ready: true });
      } else {
        // Dev fallback
        const chatId = new URLSearchParams(window.location.search).get("chatId");
        setCtx({ initData: null, chatId, userId: null, ready: true });
      }
    } catch (e) {
      console.warn("Not in Telegram Mini App context:", e);
      const chatId = new URLSearchParams(window.location.search).get("chatId");
      setCtx({ initData: null, chatId, userId: null, ready: true });
    }
  }, []);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
