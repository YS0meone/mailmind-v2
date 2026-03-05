"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Inbox, Send, Star, FileText, Trash2, Mail, Tag, Archive, Search, RefreshCw, Loader2, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { ThreadListItem } from "./thread-list-item";
import type { Thread } from "@/types/email";

interface ThreadListProps {
  threads: Thread[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  selectedId: string | null;
  activeFolder: string;
  onSelect: (thread: Thread) => void;
  onStar: (e: React.MouseEvent, thread: Thread) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
}

const FOLDERS: Record<string, { label: string; icon: typeof Inbox }> = {
  inbox: { label: "Inbox", icon: Inbox },
  sent: { label: "Sent", icon: Send },
  starred: { label: "Starred", icon: Star },
  drafts: { label: "Drafts", icon: FileText },
  trash: { label: "Trash", icon: Trash2 },
};


export function ThreadList({
  threads,
  loading,
  loadingMore,
  hasMore,
  selectedId,
  activeFolder,
  onSelect,
  onStar,
  onRefresh,
  onLoadMore,
}: ThreadListProps) {
  const [filter, setFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(true);
  const folder = FOLDERS[activeFolder] || FOLDERS.inbox;
  const FolderIcon = folder.icon;

  const filtered =
    filter === "unread" ? threads.filter((t) => t.is_unread) : threads;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b pl-5 pr-3">
        <div className="relative w-full ">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search mail..."
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className={cn("size-7", showFilters && "bg-accent")}
            onClick={() => {
              setShowFilters((p) => !p);
              if (showFilters) setFilter("all");
            }}
          >
            <SlidersHorizontal className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onRefresh}
          >
            <RefreshCw className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
          <button
            onClick={() => setFilter((f) => f === "unread" ? "all" : "unread")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
              filter === "unread"
                ? "bg-accent font-medium text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Mail className="size-3" />
            Unread
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
            <Tag className="size-3" />
            Labels
          </button>
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
            <Archive className="size-3" />
            Archived
          </button>
        </div>
      )}

      {/* Thread list */}
      <ScrollArea className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="grid h-10 grid-cols-[minmax(160px,300px)_1fr_80px] items-center border-b border-border/50 px-4">
                <Skeleton className="h-3 w-[120px]" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-8 mx-auto" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm">
              {filter === "unread" ? "No unread emails" : "No emails yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            <InfiniteScroll
              hasMore={filter === "all" && hasMore}
              isLoading={loadingMore}
              next={onLoadMore}
              rootMargin="200px"
            >
              {filtered.map((thread) => (
                <ThreadListItem
                  key={thread.id}
                  thread={thread}
                  isSelected={selectedId === thread.id}
                  activeFolder={activeFolder}
                  onSelect={onSelect}
                  onStar={onStar}
                />
              ))}
            </InfiniteScroll>
            {loadingMore && (
              <div className="flex justify-center py-3">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
