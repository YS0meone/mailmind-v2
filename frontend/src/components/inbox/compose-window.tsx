"use client";

import { useState } from "react";
import { sendEmail } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Minus, X, Send, Trash2 } from "lucide-react";

interface ComposeWindowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSent?: () => void;
}

export function ComposeWindow({ open, onOpenChange, onSent }: ComposeWindowProps) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  const resetForm = () => {
    setTo("");
    setCc("");
    setBcc("");
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

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);
    try {
      await sendEmail({
        to: [{ email: to.trim() }],
        ...(cc.trim() ? { cc: [{ email: cc.trim() }] } : {}),
        ...(bcc.trim() ? { bcc: [{ email: bcc.trim() }] } : {}),
        subject,
        body,
      });
      handleClose();
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
            <Input
              id="compose-to"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
              placeholder=""
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
              <Input
                id="compose-cc"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
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
              <Input
                id="compose-bcc"
                value={bcc}
                onChange={(e) => setBcc(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0"
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
            <Button
              onClick={handleSend}
              disabled={sending || !to || !subject}
              size="sm"
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {sending ? "Sending..." : "Send"}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-muted-foreground"
                  onClick={handleClose}
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
