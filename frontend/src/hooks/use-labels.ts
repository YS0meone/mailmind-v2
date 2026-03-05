"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listLabels,
  createLabel as apiCreateLabel,
  updateLabel as apiUpdateLabel,
  deleteLabel as apiDeleteLabel,
} from "@/lib/api-client";
import type { Label } from "@/types/email";

export function useLabels() {
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLabels = useCallback(() => {
    listLabels()
      .then((data) => setLabels(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  const createLabel = useCallback(
    async (payload: { name: string; color: string; description?: string }) => {
      const label = await apiCreateLabel(payload);
      setLabels((prev) => [...prev, label]);
      return label as Label;
    },
    []
  );

  const updateLabel = useCallback(
    async (
      id: string,
      payload: { name?: string; color?: string; description?: string; position?: number }
    ) => {
      const updated = await apiUpdateLabel(id, payload);
      setLabels((prev) => prev.map((l) => (l.id === id ? updated : l)));
      return updated as Label;
    },
    []
  );

  const deleteLabel = useCallback(async (id: string) => {
    await apiDeleteLabel(id);
    setLabels((prev) => prev.filter((l) => l.id !== id));
  }, []);

  return { labels, loading, createLabel, updateLabel, deleteLabel, refetch: fetchLabels };
}
