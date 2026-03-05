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
} from "lucide-react";
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
  onSignOut: () => void;
  onCompose: () => void;
  onFolderChange: (folder: string) => void;
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
  onSignOut,
  onCompose,
  onFolderChange,
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
              <span className="text-sm font-semibold tracking-tight">
                mailmind
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
                    <SidebarMenuButton tooltip="Ask AI">
                      <MessageSquare />
                      <span>Ask AI</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Triage Agent">
                      <Sparkles />
                      <span>Triage Agent</span>
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
