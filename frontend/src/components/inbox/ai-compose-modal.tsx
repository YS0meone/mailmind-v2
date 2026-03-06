"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2, RotateCcw, X, Check } from "lucide-react";
import { streamCompose } from "@/lib/api-client";

interface AiComposeModalProps {
  open: boolean;
  onClose: () => void;
  onAccept: (text: string) => void;
  threadSubject?: string | null;
  threadSnippet?: string | null;
  senderName?: string | null;
}

type Phase = "prompt" | "streaming" | "review";

export function AiComposeModal({
  open,
  onClose,
  onAccept,
  threadSubject,
  threadSnippet,
  senderName,
}: AiComposeModalProps) {
  const [phase, setPhase] = useState<Phase>("prompt");
  const [instruction, setInstruction] = useState("");
  const [generated, setGenerated] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && phase === "prompt") {
      setTimeout(() => promptRef.current?.focus(), 30);
    }
  }, [open, phase]);

  useEffect(() => {
    if (!open) {
      setPhase("prompt");
      setInstruction("");
      setGenerated("");
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        abortRef.current?.abort();
        onClose();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [open, onClose]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        abortRef.current?.abort();
        onClose();
      }
    };
    // Delay to avoid catching the Ctrl+M click itself
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [open, onClose]);

  const handleGenerate = useCallback(() => {
    if (!instruction.trim()) return;
    setPhase("streaming");
    setGenerated("");

    const controller = streamCompose(
      {
        instruction,
        thread_subject: threadSubject ?? undefined,
        thread_snippet: threadSnippet ?? undefined,
        sender_name: senderName ?? undefined,
      },
      (token) => setGenerated((prev) => prev + token),
      () => setPhase("review"),
      (err) => {
        console.error("AI compose error:", err);
        setPhase("review");
      },
    );
    abortRef.current = controller;
  }, [instruction, threadSubject, threadSnippet, senderName]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase("review");
  }, []);

  const handleAccept = useCallback(() => {
    onAccept(generated);
    onClose();
  }, [generated, onAccept, onClose]);

  const handleRetry = useCallback(() => {
    setGenerated("");
    setPhase("prompt");
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-2 left-2 right-2 z-50 rounded-lg border bg-popover shadow-md animate-in fade-in-0 slide-in-from-bottom-2 duration-150"
    >
      {phase === "prompt" && (
        <div className="flex items-start gap-2 p-2">
          <Sparkles className="mt-2 size-3.5 shrink-0 text-muted-foreground" />
          <Textarea
            ref={promptRef}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell AI what to write..."
            className="min-h-[36px] max-h-[80px] resize-none border-0 bg-transparent p-1 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
          <Button
            size="icon"
            variant="ghost"
            className="mt-0.5 size-7 shrink-0"
            onClick={handleGenerate}
            disabled={!instruction.trim()}
          >
            <Sparkles className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="mt-0.5 size-7 shrink-0 text-muted-foreground"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      )}

      {phase === "streaming" && (
        <div className="p-2">
          <div className="max-h-[200px] overflow-y-auto px-1 text-sm whitespace-pre-wrap">
            {generated || (
              <span className="text-muted-foreground">Generating...</span>
            )}
          </div>
          <div className="mt-2 flex justify-end border-t pt-2">
            <Button variant="ghost" size="sm" onClick={handleStop} className="h-7 gap-1 px-2 text-xs">
              <Loader2 className="size-3 animate-spin" />
              Stop
            </Button>
          </div>
        </div>
      )}

      {phase === "review" && (
        <div className="p-2">
          <div className="max-h-[200px] overflow-y-auto px-1 text-sm whitespace-pre-wrap">
            {generated || (
              <span className="text-muted-foreground">No content generated.</span>
            )}
          </div>
          <div className="mt-2 flex justify-end gap-1 border-t pt-2">
            <Button variant="ghost" size="sm" onClick={handleRetry} className="h-7 gap-1 px-2 text-xs text-muted-foreground">
              <RotateCcw className="size-3" />
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2 text-xs text-muted-foreground">
              Reject
            </Button>
            <Button size="sm" onClick={handleAccept} disabled={!generated} className="h-7 gap-1 px-2 text-xs">
              <Check className="size-3" />
              Accept
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
