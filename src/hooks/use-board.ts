"use client";

import useSWR, { mutate } from "swr";
import { useTelegram } from "@/components/telegram-provider";

function useAuthFetcher() {
  const { initData } = useTelegram();

  return async (url: string) => {
    const res = await fetch(url, {
      headers: initData ? { "x-telegram-init-data": initData } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };
}

function useAuthMutate() {
  const { initData } = useTelegram();

  return async (url: string, method: string, body?: object) => {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(initData ? { "x-telegram-init-data": initData } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  };
}

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(chatId ? `/api/members?chatId=${chatId}` : null, fetcher);
}

export function useTasks(chatId: string | null, filters?: Record<string, string>) {
  const fetcher = useAuthFetcher();
  const params = new URLSearchParams({ chatId: chatId || "", ...filters });
  return useSWR(chatId ? `/api/tasks?${params}` : null, fetcher);
}

export function useTaskDetail(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/tasks/${taskId}` : null, fetcher);
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/comments?taskId=${taskId}` : null, fetcher);
}

export function useTaskActions(chatId: string | null) {
  const api = useAuthMutate();

  return {
    createTask: async (data: { title: string; description?: string; priority?: string; assigneeId?: string; deadline?: string }) => {
      const result = await api("/api/tasks", "POST", { ...data, chatId });
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
      return result;
    },
    updateTask: async (id: string, data: object) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", data);
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
      return result;
    },
    deleteTask: async (id: string) => {
      await api(`/api/tasks/${id}`, "DELETE");
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/tasks"), undefined, { revalidate: true });
    },
    addComment: async (taskId: string, text: string) => {
      const result = await api("/api/comments", "POST", { taskId, text });
      mutate((key: string) => typeof key === "string" && key.startsWith("/api/comments"), undefined, { revalidate: true });
      return result;
    },
  };
}
