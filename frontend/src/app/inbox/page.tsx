"use client";

import { useRef, useState, useCallback } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useInbox } from "@/hooks/use-inbox";
import { getDraft } from "@/lib/api-client";
import { AppSidebar } from "@/components/inbox/sidebar";
import { ThreadList } from "@/components/inbox/thread-list";
import { EmailDetailPanel } from "@/components/inbox/email-detail-panel";
import { ComposeWindow } from "@/components/inbox/compose-window";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type { Thread, Draft } from "@/types/email";

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
  } = useInbox();

  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null);
  const detailPanelRef = useRef<PanelImperativeHandle>(null);

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
        onSignOut={handleSignOut}
        onCompose={() => {
          setEditingDraft(null);
          setComposeOpen(true);
        }}
        onFolderChange={setActiveFolder}
      />
      <SidebarInset className="overflow-hidden">
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel defaultSize={100} minSize={25}>
            <ThreadList
              threads={threads}
              loading={loading}
              loadingMore={loadingMore}
              hasMore={hasMore}
              selectedId={selectedId}
              activeFolder={activeFolder}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onSelect={onSelectThread}
              onStar={handleStar}
              onToggleRead={handleToggleRead}
              onDelete={handleDeleteInDrafts}
              onRefresh={handleRefresh}
              onLoadMore={handleLoadMore}
            />
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
              onClose={onCloseDetail}
              onDelete={handleDelete}
              onToggleRead={doToggleRead}
              onSent={handleSent}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>

      <ComposeWindow
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSent={() => {
          handleSent();
          refreshDrafts();
        }}
        draft={editingDraft}
        onDraftDeleted={handleDraftDeleted}
      />
    </SidebarProvider>
  );
}
