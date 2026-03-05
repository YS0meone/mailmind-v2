"use client";

import { useState, useEffect, useRef } from "react";
import { sendEmail } from "@/lib/api-client";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Minus, X, Send, Trash2 } from "lucide-react";
import { RecipientInput } from "./recipient-input";
import type { Participant, Draft } from "@/types/email";

interface ComposeWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
  draft?: Draft | null;
  onDraftDeleted?: () => void;
}

export function ComposeWindow({ open, onOpenChange, onSent, draft, onDraftDeleted }: ComposeWindowProps) {
  const [to, setTo] = useState<Participant[]>(draft?.to_list ?? []);
  const [cc, setCc] = useState<Participant[]>(draft?.cc_list ?? []);
  const [bcc, setBcc] = useState<Participant[]>(draft?.bcc_list ?? []);
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [body, setBody] = useState(draft?.body ?? "");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showCc, setShowCc] = useState((draft?.cc_list?.length ?? 0) > 0);
  const [showBcc, setShowBcc] = useState((draft?.bcc_list?.length ?? 0) > 0);

  const { draftId, saveStatus, scheduleSave, discard } = useDraftAutosave({
    initialDraftId: draft?.id,
    mode: "compose",
  });

  // Re-initialize state when draft prop changes (opening a different draft)
  const prevDraftIdRef = useRef(draft?.id);
  useEffect(() => {
    if (draft?.id !== prevDraftIdRef.current) {
      prevDraftIdRef.current = draft?.id;
      setTo(draft?.to_list ?? []);
      setCc(draft?.cc_list ?? []);
      setBcc(draft?.bcc_list ?? []);
      setSubject(draft?.subject ?? "");
      setBody(draft?.body ?? "");
      setShowCc((draft?.cc_list?.length ?? 0) > 0);
      setShowBcc((draft?.bcc_list?.length ?? 0) > 0);
    }
  }, [draft]);

  // Auto-save on content changes
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!open) return;
    // Skip the very first render to avoid saving initial empty state
    if (!mountedRef.current) {
      mountedRef.current = true;
      // But if resuming a draft, don't skip
      if (!draft) return;
    }
    const hasContent = to.length > 0 || subject.trim() || body.trim();
    if (hasContent) {
      scheduleSave({ subject, body, to, cc, bcc });
    }
  }, [to, cc, bcc, subject, body, open, scheduleSave, draft]);

  // Reset mounted ref when window closes
  useEffect(() => {
    if (!open) mountedRef.current = false;
  }, [open]);

  const resetForm = () => {
    setTo([]);
    setCc([]);
    setBcc([]);
    setSubject("");
    setBody("");
    setShowCc(false);
    setShowBcc(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setMinimized(false);
    resetForm();
  };

  const handleDiscard = async () => {
    await discard();
    onOpenChange(false);
    setMinimized(false);
    resetForm();
    onDraftDeleted?.();
  };

  const handleSend = async () => {
    if (to.length === 0 || !subject) return;
    setSending(true);
    try {
      await sendEmail({
        to,
        ...(cc.length > 0 ? { cc } : {}),
        ...(bcc.length > 0 ? { bcc } : {}),
        subject,
        body,
        draft_id: draftId ?? undefined,
      });
      onOpenChange(false);
      setMinimized(false);
      resetForm();
      onDraftDeleted?.();
      onSent?.();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className={`fixed bottom-0 right-6 z-50 flex w-[550px] flex-col rounded-t-lg border border-b-0 bg-background shadow-xl ${
        minimized ? "" : "h-[500px]"
      }`}
    >
      {/* Header */}
      <div
        className="flex h-10 shrink-0 cursor-pointer items-center justify-between rounded-t-lg bg-primary px-3"
        onClick={() => setMinimized((m) => !m)}
      >
        <span className="text-sm font-medium text-primary-foreground">
          {subject.trim() || "New Message"}
        </span>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  setMinimized((m) => !m);
                }}
              >
                <Minus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              {minimized ? "Expand" : "Minimize"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Close</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* To */}
          <div className="flex items-center border-b px-3">
            <Label
              htmlFor="compose-to"
              className="w-14 shrink-0 text-sm text-muted-foreground"
            >
              To
            </Label>
            <RecipientInput
              id="compose-to"
              value={to}
              onChange={setTo}
            />
            <div className="flex shrink-0 gap-1">
              {!showCc && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowCc(true)}
                >
                  Cc
                </Button>
              )}
              {!showBcc && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground"
                  onClick={() => setShowBcc(true)}
                >
                  Bcc
                </Button>
              )}
            </div>
          </div>

          {/* Cc */}
          {showCc && (
            <div className="flex items-center border-b px-3">
              <Label
                htmlFor="compose-cc"
                className="w-14 shrink-0 text-sm text-muted-foreground"
              >
                Cc
              </Label>
              <RecipientInput
                id="compose-cc"
                value={cc}
                onChange={setCc}
              />
            </div>
          )}

          {/* Bcc */}
          {showBcc && (
            <div className="flex items-center border-b px-3">
              <Label
                htmlFor="compose-bcc"
                className="w-14 shrink-0 text-sm text-muted-foreground"
              >
                Bcc
              </Label>
              <RecipientInput
                id="compose-bcc"
                value={bcc}
                onChange={setBcc}
              />
            </div>
          )}

          {/* Subject */}
          <div className="flex items-center border-b px-3">
            <Label
              htmlFor="compose-subject"
              className="w-14 shrink-0 text-sm text-muted-foreground"
            >
              Subject
            </Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>

          {/* Body */}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="min-h-0 flex-1 resize-none border-0 shadow-none focus-visible:ring-0"
          />

          {/* Footer */}
          <Separator />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSend}
                disabled={sending || to.length === 0 || !subject}
                size="sm"
                className="gap-1.5"
              >
                <Send className="size-3.5" />
                {sending ? "Sending..." : "Send"}
              </Button>
              {saveStatus !== "idle" && (
                <span className="text-[11px] text-muted-foreground/70">
                  {saveStatus === "saving" ? "Saving..." : "Draft saved"}
                </span>
              )}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={handleDiscard}
                >
                  <Trash2 className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Discard</TooltipContent>
            </Tooltip>
          </div>
        </div>
      )}
    </div>
  );
}
