"use client";

import { useState } from "react";
import { Sparkles, Loader2, Inbox } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProposals } from "@/hooks/use-proposals";
import { ProposalListItem } from "./proposal-list-item";

const PROPOSAL_TYPES = [
  { value: "draft_reply", label: "Draft Replies" },
] as const;

interface AgentInboxViewProps {
  selectedId: string | null;
  onSelectThread: (threadId: string) => void;
  onOpenDraft: (payload: Record<string, unknown>, proposalId: string) => void;
}

export function AgentInboxView({ selectedId, onSelectThread, onOpenDraft }: AgentInboxViewProps) {
  const [activeType, setActiveType] = useState<string>(PROPOSAL_TYPES[0].value);

  const { proposals, loading, updateStatus } = useProposals({
    status: "pending",
    type: activeType,
    page: 1,
    perPage: 50,
  });

  const handleAccept = async (proposalId: string, threadId: string | null, payload: Record<string, unknown>) => {
    if (payload.draft) {
      // Don't mark accepted yet — only resolved when the draft is actually sent
      onOpenDraft(payload, proposalId);
    } else {
      await updateStatus(proposalId, "accepted");
      if (threadId) onSelectThread(threadId);
    }
  };

  const handleDismiss = async (proposalId: string) => {
    await updateStatus(proposalId, "dismissed");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 border-b px-4 py-2.5">
        <Sparkles className="size-4 text-primary" />
        <span className="text-sm font-semibold">Agent Inbox</span>
      </div>

      {/* Type tabs */}
      <div className="shrink-0 border-b px-4 py-2">
        <Tabs value={activeType} onValueChange={(v) => setActiveType(v)}>
          <TabsList className="h-7">
            {PROPOSAL_TYPES.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-xs h-6 px-3">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
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
    </div>
  );
}
