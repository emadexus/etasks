"use client";

import useSWR, { mutate } from "swr";
import { useTelegram } from "@/components/telegram-provider";
import { useCallback, useMemo, useRef, useEffect } from "react";

// Use a ref so the fetcher always reads the LATEST initData,
// not a stale closure value from when SWR first bound the fetcher.
function useAuthFetcher() {
  const { initData } = useTelegram();
  const initDataRef = useRef(initData);
  useEffect(() => { initDataRef.current = initData; }, [initData]);

  return useCallback(async (url: string) => {
    const currentInitData = initDataRef.current;
    const res = await fetch(url, {
      headers: currentInitData ? { "x-telegram-init-data": currentInitData } : {},
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, []); // stable reference — reads from ref
}

function useAuthReady() {
  const { initData, ready } = useTelegram();
  return ready && !!initData;
}

function useAuthMutate() {
  const { initData } = useTelegram();
  const initDataRef = useRef(initData);
  useEffect(() => { initDataRef.current = initData; }, [initData]);

  return useCallback(async (url: string, method: string, body?: object) => {
    const currentInitData = initDataRef.current;
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(currentInitData ? { "x-telegram-init-data": currentInitData } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }, []); // stable reference
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

const swrOpts = {
  revalidateOnFocus: false,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  dedupingInterval: 0,
};

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  return useSWR(authReady && chatId ? `/api/members?chatId=${chatId}` : null, fetcher, swrOpts);
}

export function useTasks(chatId: string | null, filters?: Record<string, string>) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  const key = useMemo(() => {
    if (!authReady || !chatId) return null;
    const params = new URLSearchParams({ chatId, ...filters });
    return `/api/tasks?${params}`;
  }, [authReady, chatId, filters]);
  return useSWR(key, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useTaskDetail(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  return useSWR(authReady && taskId ? `/api/tasks/${taskId}` : null, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  return useSWR(authReady && taskId ? `/api/comments?taskId=${taskId}` : null, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useBoards() {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  return useSWR(authReady ? "/api/boards" : null, fetcher, swrOpts);
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
      revalidateTasks();
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
