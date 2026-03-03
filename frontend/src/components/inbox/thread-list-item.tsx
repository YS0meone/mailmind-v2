import { cn } from "@/lib/utils";
import { relativeTime, senderName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Star, Paperclip } from "lucide-react";
import type { Thread } from "@/types/email";

interface ThreadListItemProps {
  thread: Thread;
  isSelected: boolean;
  onSelect: (thread: Thread) => void;
  onStar: (e: React.MouseEvent, thread: Thread) => void;
}

export function ThreadListItem({
  thread,
  isSelected,
  onSelect,
  onStar,
}: ThreadListItemProps) {
  return (
    <button
      onClick={() => onSelect(thread)}
      className={cn(
        "group flex w-full flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-accent/70",
        isSelected && "bg-accent",
        thread.is_unread && !isSelected && "bg-primary/[0.04]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {thread.is_unread && (
            <span className="size-2 shrink-0 rounded-full bg-primary" />
          )}
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
        </div>
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
        <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
          {thread.message_count > 1 && (
            <Badge
              variant="secondary"
              className="px-1.5 py-0 text-[10px] font-normal"
            >
              {thread.message_count}
            </Badge>
          )}
          <div
            role="button"
            onClick={(e) => onStar(e, thread)}
            className="opacity-0 transition-opacity group-hover:opacity-100 data-[starred=true]:opacity-100"
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
      </div>
    </button>
  );
}
