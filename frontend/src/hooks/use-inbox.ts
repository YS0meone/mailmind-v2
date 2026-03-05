"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, clearToken } from "@/lib/auth";
import {
  listThreads,
  getThread,
  markThreadRead,
  toggleThreadRead,
  toggleThreadStar,
  deleteThread,
  triggerSync,
  getSyncStatus,
  getMe,
  listDrafts,
} from "@/lib/api-client";
import type { Thread, ThreadDetail, DraftListItem } from "@/types/email";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [drafts, setDrafts] = useState<DraftListItem[]>([]);
  const activeFolderRef = useRef(activeFolder);
  const searchQueryRef = useRef(searchQuery);
  activeFolderRef.current = activeFolder;
  searchQueryRef.current = searchQuery;

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
          const data = await listThreads(undefined, activeFolderRef.current, searchQueryRef.current || undefined);
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

  // Fetch threads when activeFolder or searchQuery changes + set up polling
  useEffect(() => {
    if (!isAuthenticated()) return;

    // Drafts folder: fetch drafts instead of threads
    if (activeFolder === "drafts") {
      setLoading(true);
      setHasMore(false);
      listDrafts()
        .then((data) => {
          setDrafts(data);
          // Map drafts to thread shape for the thread list
          setThreads(
            data.map((d: DraftListItem) => ({
              id: d.id,
              subject: d.subject || "(no subject)",
              snippet: d.to_list?.[0]?.email || "Draft",
              is_unread: false,
              is_starred: false,
              has_attachments: false,
              participants: d.to_list,
              last_message_at: d.updated_at,
              message_count: 0,
            }))
          );
        })
        .catch(() => {})
        .finally(() => setLoading(false));
      return; // No polling for drafts
    }

    setDrafts([]);
    setLoading(true);
    setHasMore(true);
    listThreads(undefined, activeFolder, searchQuery || undefined)
      .then((data) => {
        setThreads(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Poll only when not searching (polling during search is noisy)
    if (searchQuery) return;

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
  }, [activeFolder, searchQuery]);

  // Load more threads (infinite scroll)
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const lastThread = threads[threads.length - 1];
    if (!lastThread) return;

    setLoadingMore(true);
    listThreads(lastThread.id, activeFolder, searchQuery || undefined)
      .then((data) => {
        setThreads((prev) => [...prev, ...data]);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, threads, activeFolder, searchQuery]);

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

  const doToggleRead = useCallback(
    async (threadId: string, newUnread: boolean) => {
      // Optimistic update
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, is_unread: newUnread } : t
        )
      );
      setSelectedThread((prev) =>
        prev && prev.id === threadId ? { ...prev, is_unread: newUnread } : prev
      );
      try {
        await toggleThreadRead(threadId, newUnread);
      } catch {
        // Revert on failure
        setThreads((prev) =>
          prev.map((t) =>
            t.id === threadId ? { ...t, is_unread: !newUnread } : t
          )
        );
        setSelectedThread((prev) =>
          prev && prev.id === threadId
            ? { ...prev, is_unread: !newUnread }
            : prev
        );
      }
    },
    []
  );

  const handleToggleRead = useCallback(
    (e: React.MouseEvent, thread: Thread) => {
      e.stopPropagation();
      doToggleRead(thread.id, !thread.is_unread);
    },
    [doToggleRead]
  );

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
    if (activeFolder === "drafts") {
      listDrafts()
        .then((data) => {
          setDrafts(data);
          setThreads(
            data.map((d: DraftListItem) => ({
              id: d.id,
              subject: d.subject || "(no subject)",
              snippet: d.to_list?.[0]?.email || "Draft",
              is_unread: false,
              is_starred: false,
              has_attachments: false,
              participants: d.to_list,
              last_message_at: d.updated_at,
              message_count: 0,
            }))
          );
        })
        .catch(() => {});
      return;
    }
    setHasMore(true);
    listThreads(undefined, activeFolder)
      .then((data) => {
        setThreads(data);
        setHasMore(data.length >= PAGE_SIZE);
      })
      .catch(() => {});
  }, [activeFolder]);

  const handleSent = useCallback(() => {
    // Refresh thread list
    handleRefresh();
    // Re-fetch current thread detail if open (reply adds a new message)
    if (selectedId) {
      getThread(selectedId)
        .then((detail) => setSelectedThread(detail))
        .catch(() => {});
    }
  }, [handleRefresh, selectedId]);

  const handleSignOut = () => {
    clearToken();
    router.replace("/login");
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
    setSelectedThread(null);
  };

  const refreshDrafts = useCallback(() => {
    if (activeFolderRef.current !== "drafts") return;
    listDrafts()
      .then((data) => {
        setDrafts(data);
        setThreads(
          data.map((d: DraftListItem) => ({
            id: d.id,
            subject: d.subject || "(no subject)",
            snippet: d.to_list?.[0]?.email || "Draft",
            is_unread: false,
            is_starred: false,
            has_attachments: false,
            participants: d.to_list,
            last_message_at: d.updated_at,
            message_count: 0,
          }))
        );
      })
      .catch(() => {});
  }, []);

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
    searchQuery,
    drafts,
    setActiveFolder,
    setSearchQuery,
    handleSelectThread,
    handleStar,
    handleToggleRead,
    doToggleRead,
    handleDelete,
    handleRefresh,
    handleSent,
    handleLoadMore,
    handleSignOut,
    handleCloseDetail,
    refreshDrafts,
  };
}
