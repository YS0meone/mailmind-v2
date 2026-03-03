"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox } from "lucide-react";
import { ThreadListItem } from "./thread-list-item";
import type { Thread } from "@/types/email";

interface ThreadListProps {
  threads: Thread[];
  loading: boolean;
  selectedId: string | null;
  activeFolder: string;
  onSelect: (thread: Thread) => void;
  onStar: (e: React.MouseEvent, thread: Thread) => void;
}

const FOLDER_LABELS: Record<string, string> = {
  inbox: "Inbox",
  sent: "Sent",
  starred: "Starred",
  drafts: "Drafts",
  trash: "Trash",
};

export function ThreadList({
  threads,
  loading,
  selectedId,
  activeFolder,
  onSelect,
  onStar,
}: ThreadListProps) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "unread" ? threads.filter((t) => t.is_unread) : threads;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{FOLDER_LABELS[activeFolder] || "Inbox"}</h2>
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

      {/* Thread list */}
      <ScrollArea className="flex-1 overflow-hidden">
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
            <Inbox className="size-8 opacity-40" />
            <p className="text-sm">
              {filter === "unread" ? "No unread emails" : "No emails yet"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-px p-1">
            {filtered.map((thread) => (
              <ThreadListItem
                key={thread.id}
                thread={thread}
                isSelected={selectedId === thread.id}
                onSelect={onSelect}
                onStar={onStar}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
