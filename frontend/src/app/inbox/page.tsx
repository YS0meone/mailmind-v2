"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, clearToken } from "@/lib/auth";
import {
  listThreads,
  getThread,
  updateEmail,
  sendEmail,
  triggerSync,
  getSyncStatus,
  getMe,
} from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Mail,
  Star,
  Paperclip,
  RefreshCw,
  PenSquare,
  LogOut,
  Send,
  Inbox,
  ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────

interface Thread {
  id: string;
  subject: string | null;
  snippet: string | null;
  is_unread: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  participants: { name?: string; email: string }[] | null;
  last_message_at: string | null;
  message_count: number;
}

interface EmailMessage {
  id: string;
  thread_id: string | null;
  subject: string | null;
  snippet: string | null;
  body_html: string | null;
  from_name: string | null;
  from_email: string | null;
  to_list: { name?: string; email: string }[] | null;
  cc_list: { name?: string; email: string }[] | null;
  is_unread: boolean;
  is_starred: boolean;
  has_attachments: boolean;
  received_at: string | null;
}

interface ThreadDetail extends Thread {
  emails: EmailMessage[];
}

// ─── Helpers ──────────────────────────────────────────

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function senderName(
  participants: { name?: string; email: string }[] | null
): string {
  if (!participants || participants.length === 0) return "Unknown";
  const p = participants[0];
  return p.name || p.email.split("@")[0];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ─── Main Component ───────────────────────────────────

export default function InboxPage() {
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
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      getMe().then((u) => setUserEmail(u.email)),
      listThreads().then((data) => setThreads(data)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const handleSelectThread = useCallback(
    async (thread: Thread) => {
      setSelectedId(thread.id);
      setDetailLoading(true);
      try {
        const detail = await getThread(thread.id);
        setSelectedThread(detail);
        // Mark as read
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
    },
    []
  );

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync();
      // Poll until sync is done
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
      const data = await listThreads();
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

  const handleSend = async () => {
    if (!composeTo || !composeSubject) return;
    setSending(true);
    try {
      await sendEmail({
        to: [{ email: composeTo.trim() }],
        subject: composeSubject,
        body: composeBody,
      });
      setComposeOpen(false);
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleSignOut = () => {
    clearToken();
    router.replace("/login");
  };

  // ─── Render ───────────────────────────────────────

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* ── Header ── */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-foreground" />
            <span className="text-sm font-semibold tracking-tight">
              mailmind
            </span>
          </div>
          <Separator orientation="vertical" className="h-4" />
          <span className="font-mono text-xs text-muted-foreground">
            {userEmail}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSync}
            disabled={syncing}
            className="gap-1.5 text-xs"
          >
            <RefreshCw
              className={cn("size-3.5", syncing && "animate-spin")}
            />
            Sync
          </Button>
          <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                <PenSquare className="size-3.5" />
                Compose
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>New message</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 pt-2">
                <Input
                  placeholder="To"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="font-mono text-sm"
                />
                <Input
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                />
                <Textarea
                  placeholder="Write your message..."
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  rows={8}
                  className="resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleSend}
                    disabled={sending || !composeTo || !composeSubject}
                    size="sm"
                    className="gap-1.5"
                  >
                    <Send className="size-3.5" />
                    {sending ? "Sending..." : "Send"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Separator orientation="vertical" className="mx-1 h-4" />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut className="size-3.5" />
          </Button>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex min-h-0 flex-1">
        {/* ── Thread List ── */}
        <div className="w-[380px] shrink-0 border-r">
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex flex-col gap-1 p-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded-md p-3">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
                <Inbox className="size-8 opacity-40" />
                <p className="text-sm">No emails yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  className="gap-1.5 text-xs"
                >
                  <RefreshCw className="size-3" />
                  Sync now
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-px p-1">
                {threads.map((thread) => (
                  <button
                    key={thread.id}
                    onClick={() => handleSelectThread(thread)}
                    className={cn(
                      "group flex w-full flex-col gap-1 rounded-md px-3 py-2.5 text-left transition-colors",
                      "hover:bg-accent",
                      selectedId === thread.id && "bg-accent",
                      thread.is_unread && "bg-primary/[0.03]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          "truncate text-sm",
                          thread.is_unread
                            ? "font-semibold text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {senderName(thread.participants)}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {thread.has_attachments && (
                          <Paperclip className="size-3 text-muted-foreground/60" />
                        )}
                        <span className="font-mono text-[11px] text-muted-foreground/70">
                          {relativeTime(thread.last_message_at)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-[13px]",
                            thread.is_unread
                              ? "font-medium text-foreground"
                              : "text-foreground/80"
                          )}
                        >
                          {thread.subject || "(no subject)"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground/70">
                          {thread.snippet}
                        </p>
                      </div>
                      <div
                        role="button"
                        onClick={(e) => handleStar(e, thread)}
                        className="mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 data-[starred=true]:opacity-100"
                        data-starred={thread.is_starred}
                      >
                        <Star
                          className={cn(
                            "size-3.5 transition-colors",
                            thread.is_starred
                              ? "fill-amber-400 text-amber-400"
                              : "text-muted-foreground/50 hover:text-amber-400"
                          )}
                        />
                      </div>
                    </div>
                    {thread.message_count > 1 && (
                      <Badge
                        variant="secondary"
                        className="mt-0.5 w-fit px-1.5 py-0 text-[10px] font-normal"
                      >
                        {thread.message_count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* ── Email Detail ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {detailLoading ? (
            <div className="flex flex-col gap-4 p-6">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
              <Separator />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : selectedThread ? (
            <ScrollArea className="h-full">
              <div className="mx-auto max-w-3xl p-6">
                <h1 className="text-lg font-semibold tracking-tight">
                  {selectedThread.subject || "(no subject)"}
                </h1>
                <Separator className="my-4" />
                <div className="flex flex-col gap-6">
                  {selectedThread.emails.map((email, i) => (
                    <article key={email.id} className="flex flex-col gap-3">
                      {i > 0 && <Separator />}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {email.from_name || email.from_email}
                            {email.from_name && (
                              <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                                &lt;{email.from_email}&gt;
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            to{" "}
                            {email.to_list
                              ?.map((r) => r.name || r.email)
                              .join(", ")}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
                          {formatDate(email.received_at)}
                        </span>
                      </div>
                      {email.body_html ? (
                        <div
                          className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed [&_img]:max-w-full"
                          dangerouslySetInnerHTML={{
                            __html: email.body_html,
                          }}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {email.snippet}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground/50">
              <ChevronRight className="size-6" />
              <p className="text-sm">Select a conversation</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
