"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, Send, Star, FileText, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const folder = FOLDERS[activeFolder] || FOLDERS.inbox;
  const FolderIcon = folder.icon;

  const filtered =
    filter === "unread" ? threads.filter((t) => t.is_unread) : threads;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <FolderIcon className="size-4" />
          <h2 className="text-sm font-semibold">{folder.label}</h2>
        </div>
        <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onRefresh}
        >
          <RefreshCw className="size-3.5" />
        </Button>
        <Tabs
          value={filter}
          onValueChange={setFilter}
          className="h-auto"
        >
          <TabsList className="h-7 p-0.5">
            <TabsTrigger value="all" className="px-2.5 py-0.5 text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="unread" className="px-2.5 py-0.5 text-xs">
              Unread
            </TabsTrigger>
          </TabsList>
        </Tabs>
        </div>
      </div>

      {/* Thread list */}
      <ScrollArea className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex flex-col">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="grid h-8 grid-cols-[minmax(120px,220px)_1fr_auto] items-center border-b border-border/50 px-3">
                <Skeleton className="h-3 w-[120px]" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-8" />
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
