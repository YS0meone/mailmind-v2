"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, clearToken } from "@/lib/auth";
import {
  listThreads,
  getThread,
  updateEmail,
  triggerSync,
  getSyncStatus,
  getMe,
} from "@/lib/api-client";
import type { Thread, ThreadDetail, EmailMessage } from "@/types/email";

export function useInbox() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<ThreadDetail | null>(
    null
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
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
    listThreads(undefined, activeFolder)
      .then((data) => setThreads(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Poll for new emails every 30 seconds
    const interval = setInterval(() => {
      console.log(`[poll] fetching threads (folder=${activeFolder})...`);
      listThreads(undefined, activeFolder)
        .then((data) => {
          console.log(`[poll] got ${data.length} threads`);
          setThreads(data);
        })
        .catch((err) => console.error("[poll] failed:", err));
    }, 30_000);

    return () => clearInterval(interval);
  }, [activeFolder]);

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
        const unreadEmails = detail.emails?.filter(
          (e: EmailMessage) => e.is_unread
        );
        for (const email of unreadEmails || []) {
          updateEmail(email.id, { is_unread: false }).catch(() => {});
        }
      }
    } catch {
      setSelectedThread(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      const poll = async () => {
        for (let i = 0; i < 60; i++) {
          await new Promise((r) => setTimeout(r, 2000));
          const status = await getSyncStatus();
          const accounts = status?.accounts || [];
          const allDone = accounts.every(
            (a: { status: string }) =>
              a.status === "done" || a.status === "error" || a.status === "idle"
          );
          if (allDone) break;
        }
      };
      await poll();
      const data = await listThreads(undefined, activeFolder);
      setThreads(data);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const handleStar = async (e: React.MouseEvent, thread: Thread) => {
    e.stopPropagation();
    const newStarred = !thread.is_starred;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === thread.id ? { ...t, is_starred: newStarred } : t
      )
    );
  };

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
    detailLoading,
    activeFolder,
    setActiveFolder,
    handleSelectThread,
    handleStar,
    handleSignOut,
    handleCloseDetail,
  };
}
