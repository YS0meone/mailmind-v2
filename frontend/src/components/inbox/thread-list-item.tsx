import { cn } from "@/lib/utils";
import { relativeTime, senderName } from "@/lib/format";
import { Star, Trash2, Reply, MailOpen, Mail } from "lucide-react";
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
    <div
      role="button"
      onClick={() => onSelect(thread)}
      className={cn(
        "group relative grid h-10 w-full items-center border-b border-border/50 px-4 text-left text-[12.5px] transition-colors",
        "grid-cols-[minmax(160px,300px)_1fr_80px]",
        "hover:bg-accent hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]",
        isSelected && "bg-accent",
        thread.is_unread && !isSelected && "bg-primary/[0.03]"
      )}
    >
      {/* Col 1: Unread dot + Sender + Subject */}
      <div className="flex items-center gap-2 min-w-0 pr-4">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            thread.is_unread ? "bg-foreground" : "bg-transparent"
          )}
        />
        <span
          className={cn(
            "shrink-0",
            thread.is_unread ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          {senderName(thread.participants)}
        </span>
        <span
          className={cn(
            "truncate",
            thread.is_unread ? "font-medium text-foreground" : "text-foreground/80"
          )}
        >
          {thread.subject || "(no subject)"}
        </span>
      </div>

      {/* Col 2: Snippet */}
      <div className="min-w-0 pr-2">
        <p className="truncate text-muted-foreground/50">
          {thread.snippet}
        </p>
      </div>

      {/* Col 3: Timestamp */}
      <span className="text-center text-[11px] text-muted-foreground/60">
        {relativeTime(thread.last_message_at)}
      </span>

      {/* Hover actions — positioned at right edge of entire row */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 bg-accent pl-3 group-hover:flex">
        <ActionBtn
          title={thread.is_unread ? "Mark as read" : "Mark as unread"}
          onClick={(e) => e.stopPropagation()}
        >
          {thread.is_unread ? (
            <MailOpen className="size-3.5" />
          ) : (
            <Mail className="size-3.5" />
          )}
        </ActionBtn>
        <ActionBtn
          title={thread.is_starred ? "Unstar" : "Star"}
          onClick={(e) => onStar(e, thread)}
        >
          <Star
            className={cn(
              "size-3.5",
              thread.is_starred && "fill-foreground"
            )}
          />
        </ActionBtn>
        <ActionBtn title="Delete" onClick={(e) => e.stopPropagation()}>
          <Trash2 className="size-3.5" />
        </ActionBtn>
        <ActionBtn title="Reply" onClick={(e) => e.stopPropagation()}>
          <Reply className="size-3.5" />
        </ActionBtn>
      </div>
    </div>
  );
}

function ActionBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      title={title}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-foreground/15 hover:text-foreground"
    >
      {children}
    </div>
  );
}
