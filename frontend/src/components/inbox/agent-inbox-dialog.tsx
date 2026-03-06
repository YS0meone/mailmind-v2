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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentInboxDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
] as const;

const TYPE_OPTIONS = [
  { value: "all", label: "All types" },
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
  notify: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  draft_reply: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  flag_urgent: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  pending: "default",
  accepted: "secondary",
  rejected: "outline",
  dismissed: "outline",
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
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const perPage = 10;

  const { proposals, total, loading, updateStatus } = useProposals({
    status: statusFilter === "all" ? undefined : statusFilter,
    type: typeFilter === "all" ? undefined : typeFilter,
    page,
    perPage,
  });

  const totalPages = Math.max(1, Math.ceil(total / perPage));

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
      <DialogContent className="max-w-6xl sm:max-w-6xl h-[70vh] flex flex-col gap-0 p-0 [&>button]:top-5 [&>button]:right-5">
        {/* Header */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-5">
          <DialogTitle className="text-xl font-semibold">Agent Inbox</DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="shrink-0 flex items-center justify-between border-b px-6 pb-4 gap-6">
          <Tabs value={statusFilter} onValueChange={handleStatusChange}>
            <TabsList>
              {STATUS_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <Select value={typeFilter} onValueChange={handleTypeChange}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && proposals.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : proposals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
              <Inbox className="size-10 opacity-30" />
              <p className="text-sm">No proposals found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px] pl-6">Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[100px]">Time</TableHead>
                  <TableHead className="w-[100px] pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposals.map((p) => {
                  const Icon = TYPE_ICONS[p.type] ?? Bell;
                  const typeLabel = TYPE_OPTIONS.find((o) => o.value === p.type)?.label ?? p.type;
                  const reason = (p.payload.reason as string) || "—";

                  return (
                    <TableRow key={p.id}>
                      <TableCell className="pl-6">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
                            TYPE_COLORS[p.type],
                          )}
                        >
                          <Icon className="size-3" />
                          {typeLabel}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-0">
                        <p className="truncate text-sm" title={reason}>
                          {reason}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>
                          {p.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {formatTimeAgo(p.created_at)}
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        {p.status === "pending" && (
                          <div className="flex items-center justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                  onClick={() => updateStatus(p.id, "accepted")}
                                >
                                  <Check className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Accept</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  onClick={() => updateStatus(p.id, "rejected")}
                                >
                                  <X className="size-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">Reject</TooltipContent>
                            </Tooltip>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Footer / Pagination */}
        <div className="shrink-0 flex items-center justify-between border-t px-6 py-3">
          <p className="text-sm text-muted-foreground">
            {total} proposal{total !== 1 ? "s" : ""}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
