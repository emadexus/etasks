"use client";

import { useEffect, useState, createContext, useContext, type ReactNode } from "react";
import { setLocale } from "@/lib/i18n";

interface TelegramContext {
  initData: string | null;
  chatId: string | null;
  userId: string | null;
  openTaskId: string | null;
  startBoardChatId: string | null; // deep link: open specific board
  lang: string;
  tzOffset: number; // minutes offset from UTC (e.g. -120 for UTC+2)
  ready: boolean;
}

const TgContext = createContext<TelegramContext>({
  initData: null,
  chatId: null,
  userId: null,
  openTaskId: null,
  startBoardChatId: null,
  lang: "en",
  tzOffset: new Date().getTimezoneOffset(),
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
    startBoardChatId: null,
    lang: "en",
    tzOffset: new Date().getTimezoneOffset(),
    ready: false,
  });

  useEffect(() => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
        tg.ready();
        // Prevent accidental close by scroll
        if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
        if (tg.isVerticalSwipesEnabled !== undefined) tg.isVerticalSwipesEnabled = false;
        // Expand to full height (within Telegram's Mini App viewport, not browser fullscreen)
        if (tg.expand) tg.expand();
        const initDataRaw = tg.initData || null;
        let chatId = new URLSearchParams(window.location.search).get("chatId");
        let openTaskId: string | null = null;
        let startBoardChatId: string | null = null;
        const startParam = tg.initDataUnsafe?.start_param;
        if (startParam && startParam.startsWith("task")) {
          openTaskId = startParam.slice(4);
        } else if (startParam && startParam.startsWith("chat")) {
          const parsed = startParam.slice(4).replace("n", "-");
          chatId = parsed;
          startBoardChatId = parsed;
        } else if (startParam) {
          chatId = startParam;
        }
        const userId = tg.initDataUnsafe?.user?.id?.toString() || null;
        const lang = tg.initDataUnsafe?.user?.language_code || "en";

        setLocale(lang);
        console.log("[TG] initData:", initDataRaw ? `${initDataRaw.slice(0, 50)}...` : "null");
        console.log("[TG] chatId:", chatId, "userId:", userId, "lang:", lang, "startBoard:", startBoardChatId);
        const tzOffset = new Date().getTimezoneOffset();
        setCtx({ initData: initDataRaw, chatId, userId, openTaskId, startBoardChatId, lang, tzOffset, ready: true });
      } else {
        console.log("[TG] No Telegram WebApp global found — using dev fallback");
        const params = new URLSearchParams(window.location.search);
        const chatId = params.get("chatId") || "-4929114614";
        const userId = "247463948";
        const lang = params.get("lang") || navigator.language?.slice(0, 2) || "en";
        setLocale(lang);
        setCtx({ initData: "dev", chatId, userId, openTaskId: null, startBoardChatId: null, lang, tzOffset: new Date().getTimezoneOffset(), ready: true });
      }
    } catch (e) {
      console.warn("Not in Telegram Mini App context:", e);
      const params = new URLSearchParams(window.location.search);
      const chatId = params.get("chatId") || "-4929114614";
      const lang = params.get("lang") || navigator.language?.slice(0, 2) || "en";
      setLocale(lang);
      setCtx({ initData: "dev", chatId, userId: "247463948", openTaskId: null, startBoardChatId: null, lang, tzOffset: new Date().getTimezoneOffset(), ready: true });
    }
  }, []);

  return <TgContext.Provider value={ctx}>{children}</TgContext.Provider>;
}
