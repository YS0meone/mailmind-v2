"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, clearToken } from "@/lib/auth";
import {
  listThreads,
  getThread,
  markThreadRead,
  toggleThreadStar,
  deleteThread,
  triggerSync,
  getSyncStatus,
  getMe,
} from "@/lib/api-client";
import type { Thread, ThreadDetail } from "@/types/email";

const PAGE_SIZE = 25;

export function useInbox() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(
    null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const activeFolderRef = useRef(activeFolder);
  activeFolderRef.current = activeFolder;

  // Fetch user on mount + kick off catch-up sync
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    getMe().then((u) => setUserEmail(u.email)).catch(() => {});

    // Background catch-up sync on page load (covers any missed webhooks)
    let cancelled = false;
    (async () => {
      try {
        await triggerSync();
        console.log("[sync] catch-up sync triggered on load");
        for (let i = 0; i < 30; i++) {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 2000));
          const status = await getSyncStatus();
          const accounts = status?.accounts || [];
          const allDone = accounts.every(
            (a: { status: string }) =>
              a.status === "done" || a.status === "error" || a.status === "idle"
          );
          if (allDone) break;
        }
        if (!cancelled) {
          const data = await listThreads(undefined, activeFolderRef.current);
          console.log(`[sync] catch-up done, got ${data.length} threads`);
          setThreads(data);
          setHasMore(data.length >= PAGE_SIZE);
        }
      } catch {
        // catch-up sync is best-effort
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Fetch threads when activeFolder changes + set up polling
  useEffect(() => {
    if (!isAuthenticated()) return;

    setLoading(true);
    setHasMore(true);
    listThreads(undefined, activeFolder)
      .then((data) => {
        setThreads(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Poll for new emails every 30 seconds (first page only)
    const interval = setInterval(() => {
      listThreads(undefined, activeFolder)
        .then((data) => {
          setThreads((prev) => {
            // Merge: keep any extra pages loaded, but update first page
            const newIds = new Set(data.map((t: Thread) => t.id));
            const extraThreads = prev.filter(
              (t) => !newIds.has(t.id) && !data.some((d: Thread) => d.last_message_at && t.last_message_at && d.last_message_at > t.last_message_at)
            );
            return [...data, ...extraThreads];
          });
        })
        .catch(() => {});
    }, 30_000);

    return () => clearInterval(interval);
  }, [activeFolder]);

  // Load more threads (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const lastThread = threads[threads.length - 1];
    if (!lastThread) return;

    setLoadingMore(true);
    listThreads(lastThread.id, activeFolder)
      .then((data) => {
        setThreads((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, threads, activeFolder]);

  const handleSelectThread = useCallback(async (thread: Thread) => {
    setSelectedId(thread.id);
    setDetailLoading(true);
    try {
      const detail = await getThread(thread.id);
      setSelectedThread(detail);
      if (thread.is_unread) {
        setThreads((prev) =>
          prev.map((t) =>
            t.id === thread.id ? { ...t, is_unread: false } : t
          )
        );
        // Mark thread + all its emails as read in one call
        markThreadRead(thread.id).catch(() => {});
      }
    } catch {
      setSelectedThread(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleStar = async (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    const newStarred = !thread.is_starred;
    // Optimistic update
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id ? { ...t, is_starred: newStarred } : t
      )
    );
    try {
      await toggleThreadStar(thread.id, newStarred);
    } catch {
      // Revert on failure
      setThreads((prev) =>
        prev.map((t) =>
          t.id === thread.id ? { ...t, is_starred: !newStarred } : t
        )
      );
    }
  };

  const handleDelete = useCallback(async (threadId: string) => {
    // Optimistic: remove from list and close detail if selected
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    if (selectedId === threadId) {
      setSelectedId(null);
      setSelectedThread(null);
    }
    try {
      await deleteThread(threadId);
    } catch {
      // Revert: re-fetch on failure
      listThreads(undefined, activeFolder)
        .then((data) => {
          setThreads(data);
          setHasMore(data.length >= PAGE_SIZE);
        })
        .catch(() => {});
    }
  }, [selectedId, activeFolder]);

  const handleRefresh = useCallback(() => {
    setHasMore(true);
    listThreads(undefined, activeFolder)
      .then((data) => {
        setThreads(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {});
  }, [activeFolder]);

  const handleSignOut = () => {
    clearToken();
    router.replace("/login");
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
    setSelectedThread(null);
  };

  return {
    userEmail,
    threads,
    selectedThread,
    selectedId,
    loading,
    loadingMore,
    hasMore,
    detailLoading,
    activeFolder,
    setActiveFolder,
    handleSelectThread,
    handleStar,
    handleDelete,
    handleRefresh,
    handleLoadMore,
    handleSignOut,
    handleCloseDetail,
  };
}
