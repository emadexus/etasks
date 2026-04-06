"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { setLocale } from "@/lib/i18n";

interface TelegramContext {
  initData: string | null;
  chatId: string | null;
  userId: string | null;
  openTaskId: string | null;
  lang: string;
  ready: boolean;
}

const TgContext = createContext<TelegramContext>({
  initData: null,
  chatId: null,
  userId: null,
  openTaskId: null,
  lang: "en",
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
    lang: "en",
    ready: false,
  });

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        const initDataRaw = tg.initData || null;
        let chatId = new URLSearchParams(window.location.search).get("chatId");
        let openTaskId: string | null = null;
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith("task")) {
          openTaskId = startParam.slice(4);
        } else if (startParam && startParam.startsWith("chat")) {
          chatId = startParam.slice(4).replace("n", "-");
        } else if (startParam) {
          chatId = startParam;
        }
        const userId = tg.initDataUnsafe?.user?.id?.toString() || null;
        const lang = tg.initDataUnsafe?.user?.language_code || "en";

        setLocale(lang);
        console.log("[TG] initData:", initDataRaw ? `${initDataRaw.slice(0, 50)}...` : "null");
        console.log("[TG] chatId:", chatId, "userId:", userId, "lang:", lang);
        setCtx({ initData: initDataRaw, chatId, userId, openTaskId, lang, ready: true });
      } else {
        console.log("[TG] No Telegram WebApp global found — using dev fallback");
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId") || "-4929114614";
        const userId = "247463948";
        const lang = params.get("lang") || navigator.language?.slice(0, 2) || "en";
        setLocale(lang);
        setCtx({ initData: "dev", chatId, userId, openTaskId: null, lang, ready: true });
      }
    } catch (e) {
      console.warn("Not in Telegram Mini App context:", e);
      const params = new URLSearchParams(window.location.search);
      const chatId = params.get("chatId") || "-4929114614";
      const lang = params.get("lang") || navigator.language?.slice(0, 2) || "en";
      setLocale(lang);
      setCtx({ initData: "dev", chatId, userId: "247463948", openTaskId: null, lang, ready: true });
    }
  }, []);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
