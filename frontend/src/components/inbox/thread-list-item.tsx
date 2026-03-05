import { cn } from "@/lib/utils";
import { relativeTime, senderName, participantLabel } from "@/lib/format";
import { Star, Trash2, Reply, MailOpen, Mail } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { LabelChip } from "./label-chip";
import type { Thread } from "@/types/email";

interface ThreadListItemProps {
  thread: Thread;
  isSelected: boolean;
  isChecked: boolean;
  showCheckbox: boolean;
  activeFolder: string;
  onSelect: (thread: Thread) => void;
  onCheck: (threadId: string, checked: boolean) => void;
  onStar: (e: React.MouseEvent, thread: Thread) => void;
  onToggleRead: (e: React.MouseEvent, thread: Thread) => void;
  onDelete: (threadId: string) => void;
}

function displayName(thread: Thread, activeFolder: string): string {
  if (activeFolder === "sent") {
    // In sent folder, skip the first participant (the user) and show the recipient
    const recipients = thread.participants?.slice(1);
    if (recipients && recipients.length > 0) {
      return `to: ${participantLabel(recipients[0])}`;
    }
    return "to: Unknown";
  }
  return senderName(thread.participants);
}

export function ThreadListItem({
  thread,
  isSelected,
  isChecked,
  showCheckbox,
  activeFolder,
  onSelect,
  onCheck,
  onStar,
  onToggleRead,
  onDelete,
}: ThreadListItemProps) {
  return (
    <div
      role="button"
      onClick={() => onSelect(thread)}
      className={cn(
        "group relative grid h-10 w-full items-center border-b border-border/50 px-4 text-left text-[12.5px] transition-colors",
        "grid-cols-[minmax(160px,240px)_1fr_80px]",
        "hover:bg-accent hover:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)]",
        isSelected && "bg-accent",
        isChecked && "bg-primary/[0.06]",
        thread.is_unread && !isSelected && !isChecked && "bg-primary/[0.03]"
      )}
    >
      {/* Col 1: Checkbox/Unread dot + Sender */}
      <div className="flex items-center gap-2 min-w-0 pr-4">
        <div
          className="shrink-0 flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {showCheckbox || isChecked ? (
            <Checkbox
              checked={isChecked}
              onCheckedChange={(checked) => onCheck(thread.id, !!checked)}
              className="size-3.5"
            />
          ) : (
            <span className="group-hover:hidden">
              <span
                className={cn(
                  "block size-1.5 rounded-full",
                  thread.is_unread ? "bg-foreground" : "bg-transparent"
                )}
              />
            </span>
          )}
          {!showCheckbox && !isChecked && (
            <span className="hidden group-hover:block">
              <Checkbox
                checked={false}
                onCheckedChange={(checked) => onCheck(thread.id, !!checked)}
                className="size-3.5"
              />
            </span>
          )}
        </div>
        <span
          className={cn(
            "truncate",
            thread.is_unread ? "font-semibold text-foreground" : "text-muted-foreground"
          )}
        >
          {displayName(thread, activeFolder)}
        </span>
      </div>

      {/* Col 2: Subject + Snippet + Labels */}
      <div className="flex min-w-0 items-center gap-1.5 pr-2">
        <span
          className={cn(
            "shrink-0 truncate max-w-[50%]",
            thread.is_unread ? "font-medium text-foreground" : "text-foreground/80"
          )}
        >
          {thread.subject || "(no subject)"}
        </span>
        {thread.snippet && (
          <>
            <span className="shrink-0 text-muted-foreground/40">—</span>
            <span className="truncate text-muted-foreground/50">
              {thread.snippet}
            </span>
          </>
        )}
        {thread.labels && thread.labels.length > 0 && (
          <span className="ml-auto flex shrink-0 items-center gap-0.5">
            {thread.labels.slice(0, 3).map((label) => (
              <LabelChip key={label.id} label={label} />
            ))}
            {thread.labels.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{thread.labels.length - 3}</span>
            )}
          </span>
        )}
      </div>

      {/* Col 3: Timestamp */}
      <span className="text-center text-[11px] text-muted-foreground/60">
        {relativeTime(thread.last_message_at)}
      </span>

      {/* Hover actions — hidden for trashed threads */}
      <div className={cn(
        "absolute right-4 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 bg-accent pl-3",
        activeFolder !== "trash" && "group-hover:flex"
      )}>
        {activeFolder !== "drafts" && (
          <>
            <ActionBtn
              title={thread.is_unread ? "Mark as read" : "Mark as unread"}
              onClick={(e) => onToggleRead(e, thread)}
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
          </>
        )}
        <ActionBtn title="Delete" onClick={(e) => { e.stopPropagation(); onDelete(thread.id); }}>
          <Trash2 className="size-3.5" />
        </ActionBtn>
        {activeFolder !== "drafts" && (
          <ActionBtn title="Reply" onClick={(e) => e.stopPropagation()}>
            <Reply className="size-3.5" />
          </ActionBtn>
        )}
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
