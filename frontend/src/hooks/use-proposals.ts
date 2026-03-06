"use client";

import { useState, useEffect, useCallback } from "react";
import {
  listProposals,
  countProposals,
  updateProposal,
  type Proposal,
  type ProposalListResponse,
} from "@/lib/api-client";

const POLL_INTERVAL = 30_000; // 30s for badge count

interface UseProposalsOptions {
  status?: string;
  type?: string;
  page?: number;
  perPage?: number;
}

export function useProposals(options: UseProposalsOptions = {}) {
  const { status, type, page = 1, perPage = 20 } = options;
  const [data, setData] = useState<ProposalListResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listProposals({
        status,
        type,
        page,
        per_page: perPage,
      });
      setData(result);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [status, type, page, perPage]);

  const fetchCount = useCallback(async () => {
    try {
      const result = await countProposals("pending");
      setPendingCount(result.count);
    } catch {
      // ignore
    }
  }, []);

  // Fetch list when filters change
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Poll badge count
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCount]);

  const handleUpdateStatus = useCallback(
    async (proposalId: string, newStatus: "accepted" | "rejected" | "dismissed") => {
      try {
        await updateProposal(proposalId, newStatus);
        // Refresh both list and count
        await Promise.all([fetchList(), fetchCount()]);
      } catch {
        // ignore
      }
    },
    [fetchList, fetchCount],
  );

  return {
    proposals: data?.items ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    perPage: data?.per_page ?? perPage,
    loading,
    pendingCount,
    updateStatus: handleUpdateStatus,
    refresh: fetchList,
  };
}
