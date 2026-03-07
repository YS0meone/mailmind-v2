"use client";

import { Sparkles, FileEdit, CornerDownLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Proposal } from "@/lib/api-client";

interface ProposalListItemProps {
  proposal: Proposal;
  isSelected: boolean;
  onSelect: () => void;
  onAccept: () => void;
  onDismiss: () => void;
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
  const payload = proposal.payload;
  const senderName = (payload.thread_sender_name as string) || (payload.thread_sender_email as string) || "Unknown";
  const subject = (payload.thread_subject as string) || "(no subject)";
  const reason = (payload.reason as string) || "";
  const snippet = (payload.thread_snippet as string) || "";
  const draft = (payload.draft as string) || "";
  const acceptLabel = TYPE_ACCEPT_LABEL[proposal.type] ?? "Accept";
  const isDestructive = proposal.type === "suggest_delete";
  const AcceptIcon = isDestructive ? Trash2 : FileEdit;

  return (
    <div
      role="button"
      onClick={onSelect}
      className={cn(
        "group relative border-b border-border/50 px-4 py-2.5 cursor-pointer transition-colors",
        "hover:bg-accent hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]",
        isSelected && "bg-accent",
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
        {!draft && (
          <div
            className="flex items-center gap-1.5 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant={isDestructive ? "destructive" : "outline"}
              className="h-6 px-2.5 text-xs gap-1"
              onClick={onAccept}
            >
              <AcceptIcon className="size-3" />
              {acceptLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>

      {/* Row 3: Draft preview + action buttons */}
      {draft && (
        <div className="mt-1 ml-[22px] flex items-center gap-2">
          <CornerDownLeft className="size-3 text-muted-foreground/50 shrink-0" />
          <span className="flex-1 truncate text-xs text-muted-foreground/70 italic">
            {draft}
          </span>
          <div
            className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              variant={isDestructive ? "destructive" : "outline"}
              className="h-6 px-2.5 text-xs gap-1"
              onClick={onAccept}
            >
              <AcceptIcon className="size-3" />
              {acceptLabel}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
