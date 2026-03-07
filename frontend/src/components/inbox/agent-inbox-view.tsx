"use client";

import { useState } from "react";
import { Sparkles, Loader2, Inbox, FileEdit, Trash2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProposals } from "@/hooks/use-proposals";
import { ProposalListItem } from "./proposal-list-item";
import { AgentChatSection } from "./agent-chat-section";

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

  const isProposalTab = activeTab !== "ask_ai";

  const { proposals, loading, updateStatus } = useProposals(
    isProposalTab
      ? { status: "pending", type: activeTab, page: 1, perPage: 50 }
      : {},
  );

  const handleAccept = async (proposalId: string, threadId: string | null, payload: Record<string, unknown>) => {
    if (payload.draft) {
      // Don't mark accepted yet — only resolved when the draft is actually sent
      onOpenDraft(payload, proposalId);
    } else {
      await updateStatus(proposalId, "accepted");
      onStatusChange?.();
      if (threadId) onSelectThread(threadId);
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
        <AgentChatSection />
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
                onSelect={() => p.thread_id && onSelectThread(p.thread_id)}
                onAccept={() => handleAccept(p.id, p.thread_id, p.payload)}
                onDismiss={() => handleDismiss(p.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
