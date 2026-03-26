"use client";

import useSWR, { mutate } from "swr";
import { useTelegram } from "@/components/telegram-provider";
import { useCallback, useMemo } from "react";

function useAuthFetcher() {
  const { initData } = useTelegram();

  return useCallback(async (url: string) => {
    const res = await fetch(url, {
      headers: initData ? { "x-telegram-init-data": initData } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, [initData]);
}

function useAuthMutate() {
  const { initData } = useTelegram();

  return useCallback(async (url: string, method: string, body?: object) => {
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
  }, [initData]);
}

// Silently revalidate without clearing cache — no visual flash
function revalidateTasks() {
  mutate(
    (key: unknown) => typeof key === "string" && key.startsWith("/api/tasks"),
    undefined,
    { revalidate: true, populateCache: false }
  );
}

function revalidateComments() {
  mutate(
    (key: unknown) => typeof key === "string" && key.startsWith("/api/comments"),
    undefined,
    { revalidate: true, populateCache: false }
  );
}

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(chatId ? `/api/members?chatId=${chatId}` : null, fetcher, {
    revalidateOnFocus: false,
  });
}

export function useTasks(chatId: string | null, filters?: Record<string, string>) {
  const fetcher = useAuthFetcher();
  const key = useMemo(() => {
    if (!chatId) return null;
    const params = new URLSearchParams({ chatId, ...filters });
    return `/api/tasks?${params}`;
  }, [chatId, filters]);
  return useSWR(key, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useTaskDetail(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/tasks/${taskId}` : null, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  return useSWR(taskId ? `/api/comments?taskId=${taskId}` : null, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
}

export function useBoards() {
  const fetcher = useAuthFetcher();
  return useSWR("/api/boards", fetcher, {
    revalidateOnFocus: false,
  });
}

export function useTaskActions(chatId: string | null) {
  const api = useAuthMutate();

  return useMemo(() => ({
    createTask: async (data: { title: string; description?: string; priority?: string; assigneeId?: string; deadline?: string }) => {
      const result = await api("/api/tasks", "POST", { ...data, chatId });
      revalidateTasks();
      return result;
    },
    updateTask: async (id: string, data: object) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", data);
      // Silently revalidate — no flash, no reload
      revalidateTasks();
      // Also revalidate the specific task detail
      mutate(`/api/tasks/${id}`);
      return result;
    },
    deleteTask: async (id: string) => {
      await api(`/api/tasks/${id}`, "DELETE");
      revalidateTasks();
    },
    addComment: async (taskId: string, text: string) => {
      const result = await api("/api/comments", "POST", { taskId, text });
      revalidateComments();
      return result;
    },
  }), [api, chatId]);
}
