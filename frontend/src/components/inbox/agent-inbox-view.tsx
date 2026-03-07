"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2, Inbox, FileEdit, Trash2, MessageSquare, ChevronRight, Mail, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/format";
import { useProposals } from "@/hooks/use-proposals";
import { ProposalListItem } from "./proposal-list-item";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { AgentChatSection } from "./agent-chat-section";
import type { Thread } from "@/types/email";

const TABS = [
  { value: "ask_ai", label: "Ask AI", icon: MessageSquare },
  { value: "draft_reply", label: "Draft Replies", icon: FileEdit },
  { value: "suggest_delete", label: "Suggested Deletes", icon: Trash2 },
] as const;

interface AgentInboxViewProps {
  selectedId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenDraft: (payload: Record<string, unknown>, proposalId: string) => void;
  onStatusChange?: () => void;
}

export function AgentInboxView({ selectedId, onSelectThread, onOpenDraft, onStatusChange }: AgentInboxViewProps) {
  const [activeTab, setActiveTab] = useState<string>("ask_ai");
  const [contextThreads, setContextThreads] = useState<Thread[]>([]);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());

  const isProposalTab = activeTab !== "ask_ai";

  const { proposals, loading, updateStatus } = useProposals(
    isProposalTab
      ? { status: "pending", type: activeTab, page: 1, perPage: 50 }
      : {},
  );

  const handleCustomEvent = useCallback((name: string, data: unknown) => {
    if (name === "threads") {
      const payload = data as { threads: Thread[] };
      setContextThreads((prev) => {
        // Merge: add new threads, deduplicate by id
        const existingIds = new Set(prev.map((t) => t.id));
        const newThreads = (payload.threads || []).filter((t) => !existingIds.has(t.id));
        return [...prev, ...newThreads];
      });
    }
  }, []);

  const handleNewChat = useCallback(() => {
    setContextThreads([]);
  }, []);

  const handleSelect = useCallback((proposalId: string, threadId: string) => {
    setVisitedIds((prev) => {
      const next = new Set(prev);
      next.add(proposalId);
      return next;
    });
    onSelectThread(threadId);
  }, [onSelectThread]);

  const handleAccept = async (proposalId: string, threadId: string | null, payload: Record<string, unknown>, type: string) => {
    if (payload.draft) {
      onOpenDraft(payload, proposalId);
    } else {
      await updateStatus(proposalId, "accepted");
      onStatusChange?.();
      // Don't navigate to a thread we just deleted
      if (threadId && type !== "suggest_delete") onSelectThread(threadId);
    }
  };

  const handleDismiss = async (proposalId: string) => {
    await updateStatus(proposalId, "dismissed");
    onStatusChange?.();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex h-13 items-center gap-2 border-b pl-5 pr-3">
        <Sparkles className="size-3.5 text-muted-foreground" />
        <span className="text-sm font-medium">Agent Inbox</span>
      </div>

      {/* Tab row */}
      <div className="shrink-0 flex items-center gap-1 border-b px-3 py-1.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                isActive
                  ? "bg-accent font-medium text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {activeTab === "ask_ai" ? (
        <div className="flex-1 overflow-y-auto">
          {/* Chat section */}
          <div className="p-3 pb-0">
            <div className="h-[40dvh] rounded-lg border bg-background">
              <AgentChatSection
                onCustomEvent={handleCustomEvent}
                onNewChat={handleNewChat}
              />
            </div>
          </div>

          {/* Threads in Context */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group">
              <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
              <Mail className="size-3" />
              Threads in Context
              {contextThreads.length > 0 && (
                <span className="ml-1 text-[10px] text-muted-foreground/60">
                  ({contextThreads.length})
                </span>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent>
              {contextThreads.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <p className="text-xs">No threads in context</p>
                </div>
              ) : (
                contextThreads.map((thread) => (
                  <ContextThreadItem
                    key={thread.id}
                    thread={thread}
                    isSelected={thread.id === selectedId}
                    onClick={() => onSelectThread(thread.id)}
                  />
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Agent Proposals */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors group border-t">
              <ChevronRight className="size-3 transition-transform group-data-[state=open]:rotate-90" />
              <ClipboardList className="size-3" />
              Agent Proposals
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <p className="text-xs">No proposals yet</p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loading && proposals.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Inbox className="size-8 opacity-30" />
              <p className="text-sm">No pending proposals</p>
            </div>
          ) : (
            proposals.map((p) => (
              <ProposalListItem
                key={p.id}
                proposal={p}
                isSelected={!!p.thread_id && p.thread_id === selectedId}
                isVisited={visitedIds.has(p.id)}
                onSelect={() => p.thread_id && handleSelect(p.id, p.thread_id)}
                onAccept={() => handleAccept(p.id, p.thread_id, p.payload, p.type)}
                onDismiss={() => handleDismiss(p.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Lightweight thread row for the "Threads in Context" section. */
function ContextThreadItem({
  thread,
  isSelected,
  onClick,
}: {
  thread: Thread;
  isSelected: boolean;
  onClick: () => void;
}) {
  const senderName =
    thread.participants?.[0]?.name ||
    thread.participants?.[0]?.email ||
    "Unknown";

  return (
    <div
      role="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-4 py-2 text-[12.5px] cursor-pointer transition-colors border-b border-border/50",
        "hover:bg-accent",
        isSelected && "bg-accent",
      )}
    >
      {thread.is_unread && (
        <span className="size-1.5 rounded-full bg-primary shrink-0" />
      )}
      <span className="w-28 shrink-0 truncate font-semibold text-foreground">
        {senderName}
      </span>
      <span className="shrink-0 truncate max-w-[35%] font-medium text-foreground/80">
        {thread.subject || "(no subject)"}
      </span>
      {thread.snippet && (
        <>
          <span className="shrink-0 text-muted-foreground/40">&mdash;</span>
          <span className="flex-1 truncate text-muted-foreground/50">
            {thread.snippet}
          </span>
        </>
      )}
      {thread.last_message_at && (
        <span className="text-[11px] text-muted-foreground/60 shrink-0 ml-auto">
          {relativeTime(thread.last_message_at)}
        </span>
      )}
    </div>
  );
}
