"use client";

import { useState } from "react";
import { Sparkles, FileEdit, CornerDownLeft, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Proposal } from "@/lib/api-client";

interface ProposalListItemProps {
  proposal: Proposal;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void | Promise<void>;
  onDismiss: () => void | Promise<void>;
}

const TYPE_ACCEPT_LABEL: Record<string, string> = {
  draft_reply: "Open Draft",
  suggest_delete: "Delete",
};

export function ProposalListItem({
  proposal,
  isSelected,
  onSelect,
  onAccept,
  onDismiss,
}: ProposalListItemProps) {
  const [loading, setLoading] = useState(false);
  const payload = proposal.payload;
  const senderName = (payload.thread_sender_name as string) || (payload.thread_sender_email as string) || "Unknown";
  const subject = (payload.thread_subject as string) || "(no subject)";
  const reason = (payload.reason as string) || "";
  const snippet = (payload.thread_snippet as string) || "";
  const draft = (payload.draft as string) || "";
  const acceptLabel = TYPE_ACCEPT_LABEL[proposal.type] ?? "Accept";
  const isDestructive = proposal.type === "suggest_delete";
  const AcceptIcon = isDestructive ? Trash2 : FileEdit;

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept();
    } finally {
      setLoading(false);
    }
  };

  const acceptButton = (
    <Button
      size="sm"
      variant={isDestructive ? "destructive" : "outline"}
      className="h-6 px-2.5 text-xs gap-1"
      disabled={loading}
      onClick={isDestructive ? undefined : handleAccept}
    >
      {loading ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <AcceptIcon className="size-3" />
      )}
      {acceptLabel}
    </Button>
  );

  const actionButtons = (
    <div
      className="flex items-center gap-1.5 shrink-0"
      onClick={(e) => e.stopPropagation()}
    >
      {isDestructive ? (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            {acceptButton}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
              <AlertDialogDescription>
                This will move &ldquo;{subject}&rdquo; from {senderName} to Trash.
                You can recover it from the Trash folder later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleAccept}
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="size-3.5 mr-1" />
                )}
                Move to Trash
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        acceptButton
      )}
      <Button
        size="sm"
        variant="ghost"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        disabled={loading}
        onClick={onDismiss}
      >
        Dismiss
      </Button>
    </div>
  );

  return (
    <div
      role="button"
      onClick={onSelect}
      className={cn(
        "group relative border-b border-border/50 px-4 py-2.5 cursor-pointer transition-colors",
        "hover:bg-accent hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
        isSelected && "bg-accent",
        loading && "opacity-60 pointer-events-none",
      )}
    >
      {/* Row 1: sender, subject, snippet, time */}
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="size-1.5 rounded-full bg-primary shrink-0" />
        <span className="w-36 shrink-0 truncate font-semibold text-foreground">
          {senderName}
        </span>
        <span className="shrink-0 truncate max-w-[40%] font-medium text-foreground/80">
          {subject}
        </span>
        {snippet && (
          <>
            <span className="shrink-0 text-muted-foreground/40">—</span>
            <span className="flex-1 truncate text-muted-foreground/50">
              {snippet}
            </span>
          </>
        )}
        <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-auto">
          {relativeTime(proposal.created_at)}
        </span>
      </div>

      {/* Row 2: AI reason + action buttons (inline when no draft) */}
      <div className="mt-1 ml-[22px] flex items-center gap-2">
        <Sparkles className="size-3 text-primary shrink-0 opacity-70" />
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {reason}
        </span>
        {!draft && actionButtons}
      </div>

      {/* Row 3: Draft preview + action buttons */}
      {draft && (
        <div className="mt-1 ml-[22px] flex items-center gap-2">
          <CornerDownLeft className="size-3 text-muted-foreground/50 shrink-0" />
          <span className="flex-1 truncate text-xs text-muted-foreground/70 italic">
            {draft}
          </span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            {actionButtons}
          </div>
        </div>
      )}
    </div>
  );
}
