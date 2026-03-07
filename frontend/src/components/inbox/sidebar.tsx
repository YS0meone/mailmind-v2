"use client";

import {
  Inbox,
  Send,
  Star,
  Trash2,
  FileText,
  PenSquare,
  LogOut,
  User,
  MessageSquare,
  Sparkles,
  ChevronDown,
  Plus,
  Pencil,
} from "lucide-react";
import type { Label } from "@/types/email";
import { getLabelColor } from "@/lib/label-colors";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MailmindIcon } from "@/components/mailmind-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarProps {
  userEmail: string;
  activeFolder: string;
  labels?: Label[];
  onSignOut: () => void;
  onCompose: () => void;
  onFolderChange: (folder: string) => void;
  onAddLabel?: () => void;
  onEditLabel?: (label: Label) => void;
  onAskAI?: () => void;
  pendingProposalCount?: number;
}

const mailboxFolders = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "starred", label: "Starred", icon: Star },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function AppSidebar({
  userEmail,
  activeFolder,
  labels = [],
  onSignOut,
  onCompose,
  onFolderChange,
  onAddLabel,
  onEditLabel,
  onAskAI,
  pendingProposalCount = 0,
}: SidebarProps) {
  const { toggleSidebar } = useSidebar();
  const initials = userEmail
    .split("@")[0]
    .slice(0, 2)
    .toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="mailmind"
              onClick={toggleSidebar}
            >
              <div className="flex aspect-square size-8 items-center justify-center">
                <MailmindIcon className="size-5" />
              </div>
              <span className="text-lg font-semibold tracking-tight font-[family-name:var(--font-display)]">
                Mailmind
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Compose */}
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Compose"
                onClick={onCompose}
                className="bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground hover:shadow-md active:scale-[0.98] h-11 text-sm font-medium transition-all"
              >
                <PenSquare />
                <span>Compose</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {/* Mailbox */}
        <Collapsible defaultOpen className="group/mailbox">
          <SidebarGroup>
            <SidebarGroupLabel asChild className="mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <CollapsibleTrigger>
                Mailbox
                <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/mailbox:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mailboxFolders.map((folder) => (
                    <SidebarMenuItem key={folder.id}>
                      <SidebarMenuButton
                        tooltip={folder.label}
                        isActive={activeFolder === folder.id}
                        onClick={() => onFolderChange(folder.id)}
                      >
                        <folder.icon />
                        <span>{folder.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Labels */}
        <Collapsible defaultOpen className="group/labels">
            <SidebarGroup>
              <SidebarGroupLabel asChild className="group/label-header mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                <CollapsibleTrigger>
                  Labels
                  {onAddLabel && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onAddLabel();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          onAddLabel();
                        }
                      }}
                      title="Add label"
                      className="ml-auto flex size-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-sidebar-foreground/10 group-hover/label-header:opacity-100"
                    >
                      <Plus className="size-3.5" />
                    </div>
                  )}
                  <ChevronDown className={cn("size-4 transition-transform group-data-[state=open]/labels:rotate-180", onAddLabel ? "" : "ml-auto")} />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {labels.map((label) => {
                      const colors = getLabelColor(label.color);
                      return (
                        <SidebarMenuItem key={label.id} className="group/label-item">
                          <SidebarMenuButton
                            tooltip={label.name}
                            isActive={activeFolder === `label:${label.id}`}
                            onClick={() => onFolderChange(`label:${label.id}`)}
                          >
                            <span className={`size-2 rounded-full shrink-0 ${colors.dot}`} />
                            <span>{label.name}</span>
                          </SidebarMenuButton>
                          {onEditLabel && (
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => onEditLabel(label)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") onEditLabel(label);
                              }}
                              title="Edit label"
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded opacity-0 transition-opacity hover:bg-sidebar-foreground/10 group-hover/label-item:opacity-100"
                            >
                              <Pencil className="size-2.5 text-sidebar-foreground/70" />
                            </div>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>

        {/* AI */}
        <Collapsible defaultOpen className="group/intelligence">
          <SidebarGroup>
            <SidebarGroupLabel asChild className="mb-1 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
              <CollapsibleTrigger>
                Intelligence
                <ChevronDown className="ml-auto size-4 transition-transform group-data-[state=open]/intelligence:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Ask AI" onClick={onAskAI}>
                      <MessageSquare />
                      <span>Ask AI</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Agent Inbox"
                      isActive={activeFolder === "agent_inbox"}
                      onClick={() => onFolderChange("agent_inbox")}
                    >
                      <Sparkles />
                      <span>Agent Inbox</span>
                      {pendingProposalCount > 0 && (
                        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                          {pendingProposalCount > 99 ? "99+" : pendingProposalCount}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  tooltip={userEmail}
                >
                  <Avatar className="size-8 rounded-lg">
                    <AvatarFallback className="rounded-lg text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">
                      {userEmail.split("@")[0]}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {userEmail}
                    </span>
                  </div>
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                side="right"
                align="end"
                sideOffset={4}
              >
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  {userEmail}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onSignOut} className="text-xs">
                  <LogOut className="mr-2 size-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
