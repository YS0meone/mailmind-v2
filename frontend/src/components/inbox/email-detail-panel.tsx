"use client";

import { useEffect, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { X, Trash2, Mail, MailOpen } from "lucide-react";
import { EmailMessage } from "./email-message";
import { getDraftsByThread } from "@/lib/api-client";
import type { ThreadDetail } from "@/types/email";
import type { Draft } from "@/types/email";

interface EmailDetailPanelProps {
  thread: ThreadDetail | null;
  loading: boolean;
  onClose: () => void;
  onDelete: (threadId: string) => void;
  onToggleRead?: (threadId: string, isUnread: boolean) => void;
  onSent?: () => void;
}

export function EmailDetailPanel({
  thread,
  loading,
  onClose,
  onDelete,
  onToggleRead,
  onSent,
}: EmailDetailPanelProps) {
  const [threadDrafts, setThreadDrafts] = useState<Draft[]>([]);

  // Fetch drafts for this thread
  useEffect(() => {
    if (!thread) {
      setThreadDrafts([]);
      return;
    }
    getDraftsByThread(thread.id)
      .then((drafts) => setThreadDrafts(drafts))
      .catch(() => setThreadDrafts([]));
  }, [thread?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Separator />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!thread) return null;

  return (
    <div className="flex h-full min-w-0 flex-col">
      {/* Header bar */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b px-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
          title="Close"
        >
          <X className="size-4" />
        </Button>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={thread.is_unread ? "Mark as read" : "Mark as unread"}
            onClick={() => onToggleRead?.(thread.id, !thread.is_unread)}
          >
            {thread.is_unread ? <MailOpen className="size-4" /> : <Mail className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="Delete"
            onClick={() => onDelete(thread.id)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Email messages */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="mx-auto max-w-3xl p-6">
          <h1 className="text-lg font-bold mb-6">
            {thread.subject || "(no subject)"}
          </h1>
          <div className="flex flex-col gap-6">
            {thread.emails.map((email, i) => {
              const pendingDraft = threadDrafts.find(
                (d) => d.reply_to_message_id === email.id
              ) ?? null;
              return (
                <div key={email.id}>
                  {i > 0 && <Separator className="mb-6" />}
                  <EmailMessage
                    email={email}
                    threadEmails={thread.emails}
                    threadSubject={thread.subject}
                    onSent={onSent}
                    pendingDraft={pendingDraft}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
