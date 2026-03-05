"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Inbox, Send, Star, FileText, Trash2, Mail, Tag, Archive, Search, RefreshCw, Loader2, SlidersHorizontal, MailOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { getLabelColor } from "@/lib/label-colors";
import { InfiniteScroll } from "@/components/ui/infinite-scroll";
import { LabelPicker } from "./label-picker";
import { ThreadListItem } from "./thread-list-item";
import type { Thread, Label } from "@/types/email";

interface ThreadListProps {
  threads: Thread[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  selectedId: string | null;
  activeFolder: string;
  searchQuery: string;
  labels?: Label[];
  onSearch: (query: string) => void;
  onSelect: (thread: Thread) => void;
  onStar: (e: React.MouseEvent, thread: Thread) => void;
  onToggleRead: (e: React.MouseEvent, thread: Thread) => void;
  onDelete: (threadId: string) => void;
  onRefresh: () => void;
  onLoadMore: () => void;
  onBulkStar?: (threadIds: string[], starred: boolean) => void;
  onBulkRead?: (threadIds: string[], unread: boolean) => void;
  onBulkDelete?: (threadIds: string[]) => void;
  onBulkLabel?: (threadIds: string[], labelIds: string[]) => void;
  onCreateLabel?: (payload: { name: string; color: string }) => Promise<Label>;
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
  searchQuery,
  labels = [],
  onSearch,
  onSelect,
  onStar,
  onToggleRead,
  onDelete,
  onRefresh,
  onLoadMore,
  onBulkStar,
  onBulkRead,
  onBulkDelete,
  onBulkLabel,
  onCreateLabel,
}: ThreadListProps) {
  const [filter, setFilter] = useState("all");
  const [filterLabel, setFilterLabel] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const folder = FOLDERS[activeFolder] || FOLDERS.inbox;
  const FolderIcon = folder.icon;

  // Clear selection and label filter when folder/search changes
  useEffect(() => {
    setCheckedIds(new Set());
    setFilterLabel(null);
    setFilter("all");
  }, [activeFolder, searchQuery]);

  const handleCheck = useCallback((threadId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(threadId);
      else next.delete(threadId);
      return next;
    });
  }, []);

  const hasChecked = checkedIds.size > 0;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const filtered = threads.filter((t) => {
    if (filter === "unread" && !t.is_unread) return false;
    if (filterLabel && !t.labels?.some((l) => l.id === filterLabel)) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-13 shrink-0 items-center justify-between gap-2 border-b pl-5 pr-3">
        <div className="relative w-full ">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search mail..."
            className="h-8 pl-8 text-xs"
            value={localSearch}
            onChange={handleSearchChange}
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

      {/* Filter + Bulk action bar */}
      {showFilters && (
        <div className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5">
          {/* Select all checkbox */}
          <div
            className="flex items-center pr-1"
            title={hasChecked ? "Deselect all" : "Select all"}
          >
            <Checkbox
              checked={hasChecked && checkedIds.size === filtered.length ? true : hasChecked ? "indeterminate" : false}
              onCheckedChange={(checked) => {
                if (checked) {
                  setCheckedIds(new Set(filtered.map((t) => t.id)));
                } else {
                  setCheckedIds(new Set());
                }
              }}
              className="size-3.5"
            />
          </div>

          {/* Filters */}
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
          {/* Label filter */}
          {labels.length > 0 && (
            filterLabel ? (
              <button
                onClick={() => setFilterLabel(null)}
                className="flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-foreground transition-colors"
              >
                <span className={cn("size-2 rounded-full", getLabelColor(labels.find((l) => l.id === filterLabel)?.color || "slate").dot)} />
                {labels.find((l) => l.id === filterLabel)?.name}
                <X className="size-2.5" />
              </button>
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
                    <Tag className="size-3" />
                    Label
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1" align="start">
                  {labels.map((label) => {
                    const colors = getLabelColor(label.color);
                    return (
                      <button
                        key={label.id}
                        onClick={() => setFilterLabel(label.id)}
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <span className={cn("size-2 rounded-full", colors.dot)} />
                        {label.name}
                      </button>
                    );
                  })}
                </PopoverContent>
              </Popover>
            )
          )}
          <button className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors">
            <Archive className="size-3" />
            Archived
          </button>

          {/* Bulk actions — visible when threads are selected */}
          {hasChecked && (
            <>
              <span className="mx-1 h-4 w-px bg-border" />
              <span className="text-[11px] text-muted-foreground mr-0.5">
                {checkedIds.size} selected
              </span>
              {onBulkStar && (
                <button
                  onClick={() => {
                    const ids = [...checkedIds];
                    const anyUnstarred = ids.some((id) => !threads.find((t) => t.id === id)?.is_starred);
                    onBulkStar(ids, anyUnstarred);
                    setCheckedIds(new Set());
                  }}
                  title="Star / Unstar"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <Star className="size-3" />
                </button>
              )}
              {onBulkRead && (
                <button
                  onClick={() => {
                    const ids = [...checkedIds];
                    const anyRead = ids.some((id) => !threads.find((t) => t.id === id)?.is_unread);
                    onBulkRead(ids, anyRead);
                    setCheckedIds(new Set());
                  }}
                  title="Mark read / unread"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <MailOpen className="size-3" />
                </button>
              )}
              {onBulkDelete && (
                <button
                  onClick={() => {
                    onBulkDelete([...checkedIds]);
                    setCheckedIds(new Set());
                  }}
                  title="Delete"
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
                >
                  <Trash2 className="size-3" />
                </button>
              )}
              {onBulkLabel && labels.length > 0 && (
                <BulkLabelPicker
                  labels={labels}
                  onCreate={onCreateLabel}
                  onApply={(labelIds) => {
                    onBulkLabel([...checkedIds], labelIds);
                    setCheckedIds(new Set());
                  }}
                />
              )}
            </>
          )}
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
                  isChecked={checkedIds.has(thread.id)}
                  showCheckbox={hasChecked}
                  activeFolder={activeFolder}
                  onSelect={onSelect}
                  onCheck={handleCheck}
                  onStar={onStar}
                  onToggleRead={onToggleRead}
                  onDelete={onDelete}
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

function BulkLabelPicker({
  labels,
  onCreate,
  onApply,
}: {
  labels: Label[];
  onCreate?: (payload: { name: string; color: string }) => Promise<Label>;
  onApply: (labelIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  return (
    <LabelPicker
      labels={labels}
      selected={selected}
      onChange={(ids) => {
        setSelected(ids);
        onApply(ids);
      }}
      onCreate={onCreate}
      trigger={
        <button
          title="Add label"
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-foreground hover:bg-accent transition-colors"
        >
          <Tag className="size-3" />
        </button>
      }
    />
  );
}
