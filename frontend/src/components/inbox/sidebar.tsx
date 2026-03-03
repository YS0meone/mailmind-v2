"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Inbox,
  Send,
  Star,
  Trash2,
  FileText,
  PenSquare,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Search,
  User,
} from "lucide-react";
import { MailmindIcon } from "@/components/mailmind-icon";

interface SidebarProps {
  userEmail: string;
  activeFolder: string;
  onSignOut: () => void;
  onCompose: () => void;
  onFolderChange: (folder: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const folders = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "starred", label: "Starred", icon: Star },
  { id: "drafts", label: "Drafts", icon: FileText },
  { id: "trash", label: "Trash", icon: Trash2 },
];

export function Sidebar({
  userEmail,
  activeFolder,
  onSignOut,
  onCompose,
  onFolderChange,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  return (
    <div
      className={cn(
        "flex h-full flex-col border-r bg-sidebar transition-[width] duration-300",
        collapsed ? "w-[60px]" : "w-[240px]"
      )}
    >
      {/* Logo + collapse */}
      <div className="flex h-13 shrink-0 items-center justify-between border-b px-3">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <MailmindIcon className="size-5" />
            <span className="text-sm font-semibold tracking-tight">
              mailmind
            </span>
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Search placeholder */}
      {!collapsed && (
        <div className="px-3 pt-3 pb-1">
          <div className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-muted-foreground">
            <Search className="size-3.5" />
            <span className="text-xs">Search mail...</span>
          </div>
        </div>
      )}

      {/* Compose button */}
      <div className="px-3 pt-2">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="w-full"
                onClick={onCompose}
              >
                <PenSquare className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Compose</TooltipContent>
          </Tooltip>
        ) : (
          <Button className="w-full gap-2" onClick={onCompose}>
            <PenSquare className="size-4" />
            Compose
          </Button>
        )}
      </div>

      {/* Folders */}
      <nav className="flex flex-col gap-0.5 px-2 pt-3 flex-1">
        {folders.map((folder) => {
          const Icon = folder.icon;
          const isActive = activeFolder === folder.id;

          if (collapsed) {
            return (
              <Tooltip key={folder.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onFolderChange(folder.id)}
                    className={cn(
                      "flex items-center justify-center rounded-md p-2 transition-colors",
                      "hover:bg-accent",
                      isActive && "bg-accent text-primary font-medium"
                    )}
                  >
                    <Icon className="size-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">{folder.label}</TooltipContent>
              </Tooltip>
            );
          }

          return (
            <button
              key={folder.id}
              onClick={() => onFolderChange(folder.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                "hover:bg-accent",
                isActive
                  ? "bg-accent text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="size-4" />
              {folder.label}
            </button>
          );
        })}
      </nav>

      {/* Profile */}
      <div className="flex flex-col gap-1 border-t p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="w-full">
                    <User className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{userEmail}</TooltipContent>
              </Tooltip>
            ) : (
              <button className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-accent">
                <div className="flex size-6 items-center justify-center rounded-full bg-primary/10">
                  <User className="size-3.5 text-primary" />
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {userEmail}
                </span>
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-48">
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
      </div>
    </div>
  );
}
