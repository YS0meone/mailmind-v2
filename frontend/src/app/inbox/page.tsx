"use client";

import { useRef, useState, useCallback } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useInbox } from "@/hooks/use-inbox";
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
import type { Thread } from "@/types/email";

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
    setActiveFolder,
    setSearchQuery,
    handleSelectThread,
    handleStar,
    handleDelete,
    handleRefresh,
    handleSent,
    handleLoadMore,
    handleSignOut,
    handleCloseDetail,
  } = useInbox();

  const [composeOpen, setComposeOpen] = useState(false);
  const detailPanelRef = useRef<PanelImperativeHandle>(null);

  const onSelectThread = useCallback(
    (thread: Thread) => {
      handleSelectThread(thread);
      const panel = detailPanelRef.current;
      if (panel?.isCollapsed()) {
        panel.resize("60%");
      }
    },
    [handleSelectThread]
  );

  const onCloseDetail = useCallback(() => {
    detailPanelRef.current?.collapse();
    handleCloseDetail();
  }, [handleCloseDetail]);

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <AppSidebar
        userEmail={userEmail}
        activeFolder={activeFolder}
        onSignOut={handleSignOut}
        onCompose={() => setComposeOpen(true)}
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
              onDelete={handleDelete}
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
              onSent={handleSent}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </SidebarInset>

      <ComposeWindow open={composeOpen} onOpenChange={setComposeOpen} onSent={handleSent} />
    </SidebarProvider>
  );
}
