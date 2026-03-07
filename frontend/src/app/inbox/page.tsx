"use client";

import { useRef, useState, useCallback } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useInbox } from "@/hooks/use-inbox";
import { useLabels } from "@/hooks/use-labels";
import { useProposals } from "@/hooks/use-proposals";
import {
  getDraft,
  setThreadLabels,
  toggleThreadStar,
  toggleThreadRead,
  deleteThread,
  updateProposal,
} from "@/lib/api-client";
import { AppSidebar } from "@/components/inbox/sidebar";
import { ThreadList } from "@/components/inbox/thread-list";
import { EmailDetailPanel } from "@/components/inbox/email-detail-panel";
import { ComposeWindow } from "@/components/inbox/compose-window";
import { AgentInboxView } from "@/components/inbox/agent-inbox-view";
import { LabelEditDialog } from "@/components/inbox/label-edit-dialog";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { Thread, ThreadDetail, Draft, Label, Participant } from "@/types/email";

export default function InboxPage() {
  const {
    userEmail,
    threads,
    selectedThread,
    selectedId,
    loading,
    loadingMore,
    hasMore,
    detailLoading,
    activeFolder,
    searchQuery,
    drafts,
    setActiveFolder,
    setSearchQuery,
    selectThreadById,
    handleSelectThread,
    handleStar,
    handleToggleRead,
    doToggleRead,
    handleDelete,
    handleRefresh,
    handleSent,
    handleLoadMore,
    handleSignOut,
    handleCloseDetail,
    refreshDrafts,
    setThreads,
    setSelectedThread,
  } = useInbox();

  const { labels, createLabel, updateLabel, deleteLabel } = useLabels();
  const { pendingCount, refreshCount } = useProposals();

  const [composeOpen, setComposeOpen] = useState(false);
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const [composePrefill, setComposePrefill] = useState<{ to?: Participant[]; subject?: string; body?: string } | null>(null);
  const [pendingProposalId, setPendingProposalId] = useState<string | null>(null);
  const [readThreadIds, setReadThreadIds] = useState<Set<string>>(new Set());
  const detailPanelRef = useRef<PanelImperativeHandle>(null);

  const handleLabelsChange = useCallback(
    async (threadId: string, labelIds: string[]) => {
      try {
        const updatedLabels = await setThreadLabels(threadId, labelIds);
        // Update thread list
        setThreads((prev: Thread[]) =>
          prev.map((t: Thread) =>
            t.id === threadId ? { ...t, labels: updatedLabels } : t
          )
        );
        // Update detail panel
        setSelectedThread((prev: ThreadDetail | null) =>
          prev && prev.id === threadId
            ? { ...prev, labels: updatedLabels }
            : prev
        );
      } catch {
        // ignore
      }
    },
    []
  );

  const handleBulkStar = useCallback(
    async (threadIds: string[], starred: boolean) => {
      setThreads((prev: Thread[]) =>
        prev.map((t: Thread) =>
          threadIds.includes(t.id) ? { ...t, is_starred: starred } : t
        )
      );
      await Promise.allSettled(
        threadIds.map((id) => toggleThreadStar(id, starred))
      );
    },
    []
  );

  const handleBulkRead = useCallback(
    async (threadIds: string[], unread: boolean) => {
      setThreads((prev: Thread[]) =>
        prev.map((t: Thread) =>
          threadIds.includes(t.id) ? { ...t, is_unread: unread } : t
        )
      );
      await Promise.allSettled(
        threadIds.map((id) => toggleThreadRead(id, unread))
      );
    },
    []
  );

  const handleBulkDelete = useCallback(
    async (threadIds: string[]) => {
      setThreads((prev: Thread[]) =>
        prev.filter((t: Thread) => !threadIds.includes(t.id))
      );
      await Promise.allSettled(threadIds.map((id) => deleteThread(id)));
    },
    []
  );

  const handleBulkLabel = useCallback(
    async (threadIds: string[], labelIds: string[]) => {
      await Promise.allSettled(
        threadIds.map((id) => setThreadLabels(id, labelIds))
      );
      handleRefresh();
    },
    [handleRefresh]
  );

  const onSelectThread = useCallback(
    (thread: Thread) => {
      // In drafts folder, clicking a compose draft opens ComposeWindow
      if (activeFolder === "drafts") {
        const draftItem = drafts.find((d) => d.id === thread.id);
        if (draftItem && draftItem.mode === "compose") {
          getDraft(draftItem.id)
            .then((full: Draft) => {
              setEditingDraft(full);
              setComposeOpen(true);
            })
            .catch(() => {});
          return;
        }
        // For reply/forward drafts, open the thread detail
        if (draftItem?.thread_id) {
          handleSelectThread({ ...thread, id: draftItem.thread_id });
          const panel = detailPanelRef.current;
          if (panel?.isCollapsed()) {
            panel.resize("60%");
          }
          return;
        }
      }

      handleSelectThread(thread);
      const panel = detailPanelRef.current;
      if (panel?.isCollapsed()) {
        panel.resize("60%");
      }
    },
    [handleSelectThread, activeFolder, drafts]
  );

  const onCloseDetail = useCallback(() => {
    detailPanelRef.current?.collapse();
    handleCloseDetail();
  }, [handleCloseDetail]);

  const handleDraftDeleted = useCallback(() => {
    setEditingDraft(null);
    refreshDrafts();
  }, [refreshDrafts]);

  const handleDeleteInDrafts = useCallback(
    async (threadId: string) => {
      if (activeFolder === "drafts") {
        // threadId is actually draft.id in drafts view
        const { deleteDraft } = await import("@/lib/api-client");
        try {
          await deleteDraft(threadId);
        } catch {
          // ignore
        }
        refreshDrafts();
        return;
      }
      handleDelete(threadId);
    },
    [activeFolder, handleDelete, refreshDrafts]
  );

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <AppSidebar
        userEmail={userEmail}
        activeFolder={activeFolder}
        labels={labels}
        onSignOut={handleSignOut}
        onCompose={() => {
          setEditingDraft(null);
          setComposePrefill(null);
          setPendingProposalId(null);
          setComposeOpen(true);
        }}
        onFolderChange={setActiveFolder}
        onAddLabel={() => {
          setEditingLabel(null);
          setLabelDialogOpen(true);
        }}
        onEditLabel={(label) => {
          setEditingLabel(label);
          setLabelDialogOpen(true);
        }}
        pendingProposalCount={pendingCount}
      />
      <SidebarInset className="overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={100} minSize={25}>
            {activeFolder === "agent_inbox" ? (
              <AgentInboxView
                selectedId={selectedId}
                readThreadIds={readThreadIds}
                onStatusChange={refreshCount}
                onSelectThread={(threadId) => {
                  selectThreadById(threadId);
                  setReadThreadIds((prev) => {
                    const next = new Set(prev);
                    next.add(threadId);
                    return next;
                  });
                  const panel = detailPanelRef.current;
                  if (panel?.isCollapsed()) panel.resize("60%");
                }}
                onOpenDraft={(payload, proposalId) => {
                  const senderEmail = payload.thread_sender_email as string;
                  const senderName = payload.thread_sender_name as string;
                  const subject = payload.thread_subject as string;
                  const draft = payload.draft as string;
                  setEditingDraft(null);
                  setComposePrefill({
                    to: senderEmail ? [{ name: senderName || senderEmail, email: senderEmail }] : [],
                    subject: subject ? (subject.startsWith("Re:") ? subject : `Re: ${subject}`) : "",
                    body: draft,
                  });
                  setPendingProposalId(proposalId);
                  setComposeOpen(true);
                }}
              />
            ) : (
              <ThreadList
                threads={threads}
                loading={loading}
                loadingMore={loadingMore}
                hasMore={hasMore}
                selectedId={selectedId}
                activeFolder={activeFolder}
                searchQuery={searchQuery}
                labels={labels}
                onSearch={setSearchQuery}
                onSelect={onSelectThread}
                onStar={handleStar}
                onToggleRead={handleToggleRead}
                onDelete={handleDeleteInDrafts}
                onRefresh={handleRefresh}
                onLoadMore={handleLoadMore}
                onBulkStar={handleBulkStar}
                onBulkRead={handleBulkRead}
                onBulkDelete={handleBulkDelete}
                onBulkLabel={handleBulkLabel}
                onCreateLabel={createLabel}
              />
            )}
          </ResizablePanel>

          <ResizableHandle />

          <ResizablePanel
            panelRef={detailPanelRef}
            defaultSize={0}
            minSize={30}
            collapsible
            collapsedSize={0}
          >
            <EmailDetailPanel
              thread={selectedThread}
              loading={detailLoading}
              allLabels={labels}
              onClose={onCloseDetail}
              onDelete={handleDelete}
              onToggleRead={doToggleRead}
              onSent={handleSent}
              onLabelsChange={handleLabelsChange}
              onCreateLabel={createLabel}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>

      <ComposeWindow
        open={composeOpen}
        onOpenChange={(open) => {
          setComposeOpen(open);
          if (!open) setPendingProposalId(null);
        }}
        onSent={() => {
          handleSent();
          refreshDrafts();
          if (pendingProposalId) {
            updateProposal(pendingProposalId, "accepted").catch(() => {});
            setPendingProposalId(null);
          }
        }}
        draft={editingDraft}
        onDraftDeleted={handleDraftDeleted}
        prefill={composePrefill}
      />

      <LabelEditDialog
        open={labelDialogOpen}
        onOpenChange={setLabelDialogOpen}
        label={editingLabel}
        onSave={updateLabel}
        onCreate={createLabel}
        onDelete={deleteLabel}
      />
    </SidebarProvider>
  );
}
