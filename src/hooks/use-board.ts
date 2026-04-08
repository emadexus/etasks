"use client";

import useSWR from "swr";
import { useTelegram } from "@/components/telegram-provider";
import { useCallback, useMemo, useRef, useEffect } from "react";

// Use a ref so the fetcher always reads the LATEST initData,
// not a stale closure value from when SWR first bound the fetcher.
function useAuthFetcher() {
  const { initData } = useTelegram();
  const initDataRef = useRef(initData);
  // Sync update during render — useEffect is too late (runs after render,
  // so SWR can call the fetcher before the effect updates the ref)
  initDataRef.current = initData;

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
  initDataRef.current = initData;

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

const swrOpts = {
  revalidateOnFocus: true,
  refreshInterval: 5000,
  shouldRetryOnError: true,
  errorRetryCount: 3,
  errorRetryInterval: 1000,
  dedupingInterval: 2000,
};

function useKeyWhenReady(key: string | null) {
  const authReady = useAuthReady();
  return authReady ? key : null;
}

// ─── Existing board-scoped hooks ───

export function useMembers(chatId: string | null) {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady(chatId ? `/api/members?chatId=${chatId}` : null);
  return useSWR(key, fetcher, swrOpts);
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
  const key = useKeyWhenReady(taskId ? `/api/tasks/${taskId}` : null);
  return useSWR(key, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useComments(taskId: string | null) {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady(taskId ? `/api/comments?taskId=${taskId}` : null);
  return useSWR(key, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useBoards() {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady("/api/boards");
  return useSWR(key, fetcher, swrOpts);
}

export function useTaskActions(chatId: string | null) {
  const api = useAuthMutate();

  return useMemo(() => ({
    createTask: async (data: { title: string; description?: string; priority?: string; assigneeId?: string; dateDue?: string; chatId?: string; projectId?: string; datePlanned?: string; recurrenceRule?: string }) => {
      const result = await api("/api/tasks", "POST", { ...data, chatId: data.chatId || chatId });
      return result;
    },
    updateTask: async (id: string, data: Record<string, any>) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", data);
      return result;
    },
    deleteTask: async (id: string) => {
      await api(`/api/tasks/${id}`, "DELETE");
    },
    addComment: async (taskId: string, text: string) => {
      const result = await api("/api/comments", "POST", { taskId, text });
      return result;
    },
    moveTask: async (id: string, boardId: string | null) => {
      const result = await api(`/api/tasks/${id}`, "PATCH", { boardId });
      return result;
    },
  }), [api, chatId]);
}

// ─── New user-centric hooks ───

/** Combined home data: user + counts + boards + projects in one request. */
export function useHome() {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady("/api/home");
  return useSWR(key, fetcher, swrOpts);
}

export function useUser() {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady("/api/user");
  return useSWR(key, fetcher, swrOpts);
}

export function useSmartFilterCounts() {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady("/api/user/counts");
  return useSWR(key, fetcher, swrOpts);
}

export function useFilteredTasks(filter: string, projectId?: string, chatId?: string) {
  const fetcher = useAuthFetcher();
  const authReady = useAuthReady();
  const key = useMemo(() => {
    if (!authReady || !filter) return null;
    const params = new URLSearchParams({ filter });
    if (projectId) params.set("projectId", projectId);
    if (chatId) params.set("chatId", chatId);
    return `/api/user/tasks?${params}`;
  }, [authReady, filter, projectId, chatId]);
  return useSWR(key, fetcher, { ...swrOpts, keepPreviousData: true });
}

export function useProjects() {
  const fetcher = useAuthFetcher();
  const key = useKeyWhenReady("/api/projects");
  return useSWR(key, fetcher, swrOpts);
}

export function useUserActions() {
  const api = useAuthMutate();

  return useMemo(() => ({
    updateLanguage: async (language: string) => {
      const result = await api("/api/user", "PATCH", { language });
      return result;
    },
  }), [api]);
}

export function useBoardActions() {
  const api = useAuthMutate();

  return useMemo(() => ({
    updateBoardLanguage: async (boardId: string, language: string) => {
      const result = await api("/api/boards", "PATCH", { boardId, language });
      return result;
    },
  }), [api]);
}

export function useProjectActions() {
  const api = useAuthMutate();

  return useMemo(() => ({
    createProject: async (data: { name: string; color?: string; icon?: string }) => {
      const result = await api("/api/projects", "POST", data);
      return result;
    },
    updateProject: async (id: string, data: object) => {
      const result = await api(`/api/projects/${id}`, "PATCH", data);
      return result;
    },
    deleteProject: async (id: string) => {
      await api(`/api/projects/${id}`, "DELETE");
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
      return res.json();
    },
  }), []);
}
