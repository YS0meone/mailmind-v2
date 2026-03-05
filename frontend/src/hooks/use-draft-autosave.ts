"use client";

import { useRef, useCallback, useState } from "react";
import { createDraft, updateDraft, deleteDraft } from "@/lib/api-client";
import type { Participant } from "@/types/email";

export type DraftSaveStatus = "idle" | "saving" | "saved";

interface DraftState {
  subject: string;
  body: string;
  to: Participant[];
  cc: Participant[];
  bcc: Participant[];
}

interface UseDraftAutosaveOptions {
  initialDraftId?: string;
  mode?: string;
  replyToMessageId?: string;
  threadId?: string;
  debounceMs?: number;
}

export function useDraftAutosave({
  initialDraftId,
  mode = "compose",
  replyToMessageId,
  threadId,
  debounceMs = 2000,
}: UseDraftAutosaveOptions = {}) {
  const draftIdRef = useRef<string | null>(initialDraftId ?? null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingRef = useRef<DraftState | null>(null);
  const [saveStatus, setSaveStatus] = useState<DraftSaveStatus>("idle");

  const doSave = useCallback(
    async (state: DraftState) => {
      if (savingRef.current) {
        pendingRef.current = state;
        return;
      }
      savingRef.current = true;
      setSaveStatus("saving");
      try {
        if (!draftIdRef.current) {
          const draft = await createDraft({
            subject: state.subject || undefined,
            body: state.body || undefined,
            to: state.to.length > 0 ? state.to : undefined,
            cc: state.cc.length > 0 ? state.cc : undefined,
            bcc: state.bcc.length > 0 ? state.bcc : undefined,
            mode,
            reply_to_message_id: replyToMessageId,
            thread_id: threadId,
          });
          draftIdRef.current = draft.id;
        } else {
          await updateDraft(draftIdRef.current, {
            subject: state.subject,
            body: state.body,
            to: state.to,
            cc: state.cc,
            bcc: state.bcc,
          });
        }
        setSaveStatus("saved");
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setSaveStatus("idle"), 3000);
      } catch {
        setSaveStatus("idle");
      } finally {
        savingRef.current = false;
        if (pendingRef.current) {
          const next = pendingRef.current;
          pendingRef.current = null;
          doSave(next);
        }
      }
    },
    [mode, replyToMessageId, threadId]
  );

  const scheduleSave = useCallback(
    (state: DraftState) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSaveStatus("idle");
      timerRef.current = setTimeout(() => doSave(state), debounceMs);
    },
    [doSave, debounceMs]
  );

  const discard = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveStatus("idle");
    const id = draftIdRef.current;
    draftIdRef.current = null;
    if (id) {
      try {
        await deleteDraft(id);
      } catch {
        // ignore
      }
    }
  }, []);

  return {
    get draftId() {
      return draftIdRef.current;
    },
    saveStatus,
    scheduleSave,
    discard,
  };
}
