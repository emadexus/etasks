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
    (key: unknown) => typeof key === "string" && (key.startsWith("/api/tasks") || key.startsWith("/api/user/tasks") || key.startsWith("/api/user/counts")),
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

function revalidateProjects() {
  mutate(
    (key: unknown) => typeof key === "string" && key.startsWith("/api/projects"),
    undefined,
    { revalidate: true, populateCache: false }
  );
}

function revalidateHome() {
  mutate(
    (key: unknown) => typeof key === "string" && key.startsWith("/api/home"),
    undefined,
    { revalidate: true, populateCache: false }
  );
}

function revalidateAttachments() {
  mutate(
    (key: unknown) => typeof key === "string" && key.startsWith("/api/attachments"),
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

// Paused SWR options: always provide the key (for cache hits),
// but pause fetching until auth is ready. This lets localStorage
// cache return data instantly on app open.
function usePausedOpts(extraOpts?: Record<string, any>) {
  const authReady = useAuthReady();
  return useMemo(() => ({
    ...swrOpts,
    ...extraOpts,
    isPaused: () => !authReady,
  }), [authReady]);
}

// ─── Existing board-scoped hooks ───

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR(chatId ? `/api/members?chatId=${chatId}` : null, fetcher, opts);
}

export function useTasks(chatId: string | null, filters?: Record<string, string>) {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts({ keepPreviousData: true });
  const key = useMemo(() => {
    if (!chatId) return null;
    const params = new URLSearchParams({ chatId, ...filters });
    return `/api/tasks?${params}`;
  }, [chatId, filters]);
  return useSWR(key, fetcher, opts);
}

export function useTaskDetail(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts({ keepPreviousData: true });
  return useSWR(taskId ? `/api/tasks/${taskId}` : null, fetcher, opts);
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts({ keepPreviousData: true });
  return useSWR(taskId ? `/api/comments?taskId=${taskId}` : null, fetcher, opts);
}

export function useBoards() {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR("/api/boards", fetcher, opts);
}

export function useTaskActions(chatId: string | null) {
  const api = useAuthMutate();

  return useMemo(() => ({
    createTask: async (data: { title: string; description?: string; priority?: string; assigneeId?: string; dateDue?: string; chatId?: string; projectId?: string; datePlanned?: string; notifyAt?: string; recurrenceRule?: string }) => {
      const result = await api("/api/tasks", "POST", { ...data, chatId: data.chatId || chatId });
      revalidateTasks();
      return result;
    },
    updateTask: async (id: string, data: Record<string, any>) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", data);
      revalidateTasks();
      mutate(`/api/tasks/${id}`);
      if ("archivedAt" in data) revalidateHome();
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
    moveTask: async (id: string, boardId: string | null) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", { boardId });
      revalidateTasks();
      revalidateHome();
      mutate(`/api/tasks/${id}`);
      return result;
    },
  }), [api, chatId]);
}

// ─── New user-centric hooks ───

/** Combined home data: user + counts + boards + projects in one request. */
export function useHome() {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR("/api/home", fetcher, opts);
}

export function useUser() {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR("/api/user", fetcher, opts);
}

export function useSmartFilterCounts() {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR("/api/user/counts", fetcher, opts);
}

export function useFilteredTasks(filter: string, projectId?: string, chatId?: string) {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts({ keepPreviousData: true });
  const key = useMemo(() => {
    if (!filter) return null;
    const params = new URLSearchParams({ filter });
    if (projectId) params.set("projectId", projectId);
    if (chatId) params.set("chatId", chatId);
    return `/api/user/tasks?${params}`;
  }, [filter, projectId, chatId]);
  return useSWR(key, fetcher, opts);
}

export function useProjects() {
  const fetcher = useAuthFetcher();
  const opts = usePausedOpts();
  return useSWR("/api/projects", fetcher, opts);
}

export function useProjectActions() {
  const api = useAuthMutate();

  return useMemo(() => ({
    createProject: async (data: { name: string; color?: string; icon?: string }) => {
      const result = await api("/api/projects", "POST", data);
      revalidateProjects();
      return result;
    },
    updateProject: async (id: string, data: object) => {
      const result = await api(`/api/projects/${id}`, "PATCH", data);
      revalidateProjects();
      return result;
    },
    deleteProject: async (id: string) => {
      await api(`/api/projects/${id}`, "DELETE");
      revalidateProjects();
    },
  }), [api]);
}

// ─── Attachments ───

export function useAttachments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  return useSWR(authReady && taskId ? `/api/attachments?taskId=${taskId}` : null, fetcher, swrOpts);
}

export function useAttachmentActions() {
  const { initData } = useTelegram();
  const initDataRef = useRef(initData);
  useEffect(() => { initDataRef.current = initData; }, [initData]);

  return useMemo(() => ({
    uploadFile: async (taskId: string, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("taskId", taskId);

      const res = await fetch("/api/attachments", {
        method: "POST",
        headers: initDataRef.current ? { "x-telegram-init-data": initDataRef.current } : {},
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
      revalidateAttachments();
      return res.json();
    },
  }), []);
}
