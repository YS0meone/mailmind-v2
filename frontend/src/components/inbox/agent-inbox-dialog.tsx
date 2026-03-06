"use client";

import { useState, useCallback } from "react";
import { useProposals } from "@/hooks/use-proposals";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bell,
  MessageSquareReply,
  AlertTriangle,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentInboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
] as const;

const TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "notify", label: "Notify" },
  { value: "draft_reply", label: "Draft Reply" },
  { value: "flag_urgent", label: "Urgent" },
] as const;

const TYPE_ICONS: Record<string, typeof Bell> = {
  notify: Bell,
  draft_reply: MessageSquareReply,
  flag_urgent: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  notify: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  draft_reply: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  flag_urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

function formatTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AgentInboxDialog({ open, onOpenChange }: AgentInboxDialogProps) {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const { proposals, total, loading, updateStatus } = useProposals({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    page,
    perPage: 20,
  });

  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleTypeChange = useCallback((value: string) => {
    setTypeFilter(value);
    setPage(1);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg">Agent Inbox</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex items-center justify-between border-b px-6 pb-3 gap-4">
          <Tabs value={statusFilter} onValueChange={handleStatusChange}>
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="h-8 rounded-md border bg-transparent px-2 text-xs"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-6">
          {loading && proposals.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              No proposals found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2.5 font-medium">Type</th>
                  <th className="py-2.5 font-medium">Reason</th>
                  <th className="py-2.5 font-medium">Status</th>
                  <th className="py-2.5 font-medium">Time</th>
                  <th className="py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => {
                  const Icon = TYPE_ICONS[p.type] ?? Bell;
                  const reason = (p.payload.reason as string) || "—";
                  return (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={cn("flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TYPE_COLORS[p.type])}>
                            <Icon className="size-3" />
                            {TYPE_OPTIONS.find((o) => o.value === p.type)?.label ?? p.type}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 max-w-[250px] truncate">
                        {reason}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={p.status === "pending" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(p.created_at)}
                      </td>
                      <td className="py-2.5 text-right">
                        {p.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                  onClick={() => updateStatus(p.id, "accepted")}
                                >
                                  <Check className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Accept</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => updateStatus(p.id, "rejected")}
                                >
                                  <X className="size-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Reject</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
            <span>
              {total} proposal{total !== 1 ? "s" : ""}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span>
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-7"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
