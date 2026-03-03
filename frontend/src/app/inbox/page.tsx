"use client";

import { useRef, useState, useCallback } from "react";
import type { PanelImperativeHandle } from "react-resizable-panels";
import { useInbox } from "@/hooks/use-inbox";
import { Sidebar } from "@/components/inbox/sidebar";
import { ThreadList } from "@/components/inbox/thread-list";
import { EmailDetailPanel } from "@/components/inbox/email-detail-panel";
import { ComposeDialog } from "@/components/inbox/compose-dialog";
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
    detailLoading,
    activeFolder,
    setActiveFolder,
    handleSelectThread,
    handleStar,
    handleSignOut,
    handleCloseDetail,
  } = useInbox();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="flex h-dvh overflow-hidden bg-background">
      <Sidebar
        userEmail={userEmail}
        activeFolder={activeFolder}
        onSignOut={handleSignOut}
        onCompose={() => setComposeOpen(true)}
        onFolderChange={setActiveFolder}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((p) => !p)}
      />

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={100} minSize={25}>
          <ThreadList
            threads={threads}
            loading={loading}
            selectedId={selectedId}
            activeFolder={activeFolder}
            onSelect={onSelectThread}
            onStar={handleStar}
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
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      <ComposeDialog open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
