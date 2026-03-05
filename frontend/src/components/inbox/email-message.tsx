"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Reply, ReplyAll, Forward, Send, Trash2, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { sendEmail } from "@/lib/api-client";
import type { EmailMessage as EmailMessageType } from "@/types/email";

interface EmailMessageProps {
  email: EmailMessageType;
  threadSubject?: string | null;
  onSent?: () => void;
}

function SandboxedHtml({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(150);

  const srcdoc = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; font-size: 14px; line-height: 1.6; color: #1a1a1a; overflow: hidden; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  pre { overflow-x: auto; white-space: pre-wrap; }
  * { max-width: 100%; box-sizing: border-box; }
  a { color: #2563eb; }
</style>
</head><body>${html}</body></html>`;

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const resizeObserver = new ResizeObserver(() => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0) setHeight(h);
        }
      } catch {
        // cross-origin guard
      }
    });

    const onLoad = () => {
      try {
        const doc = iframe.contentDocument;
        if (doc?.body) {
          const h = doc.body.scrollHeight;
          if (h > 0) setHeight(h);
          resizeObserver.observe(doc.body);
        }
      } catch {
        // cross-origin guard
      }
    };

    iframe.addEventListener("load", onLoad);
    return () => {
      iframe.removeEventListener("load", onLoad);
      resizeObserver.disconnect();
    };
  }, [srcdoc]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-same-origin"
      title="Email content"
      className="w-full border-0"
      style={{ height, display: "block" }}
    />
  );
}

type ComposeMode = "reply" | "reply-all" | "forward";

function buildQuotedHeader(email: EmailMessageType): string {
  const date = email.received_at
    ? new Date(email.received_at).toLocaleString()
    : "";
  const from = email.from_name
    ? `${email.from_name} <${email.from_email}>`
    : email.from_email || "";
  return `On ${date}, ${from} wrote:`;
}

function getReplyAllRecipients(
  email: EmailMessageType,
  userEmail?: string
): { to: string; cc: string } {
  // To: original sender
  const toEmails = [email.from_email || ""];
  // Cc: original to + cc, excluding the user and the sender
  const exclude = new Set(
    [userEmail, email.from_email].filter(Boolean).map((e) => e!.toLowerCase())
  );
  const ccEmails = [
    ...(email.to_list || []),
    ...(email.cc_list || []),
  ]
    .map((p) => p.email)
    .filter((e) => !exclude.has(e.toLowerCase()));
  return {
    to: toEmails.join(", "),
    cc: [...new Set(ccEmails)].join(", "),
  };
}

interface InlineReplyBoxProps {
  email: EmailMessageType;
  mode: ComposeMode;
  threadSubject?: string | null;
  onModeChange: (mode: ComposeMode) => void;
  onClose: () => void;
  onSent?: () => void;
}

function InlineReplyBox({
  email,
  mode,
  threadSubject,
  onModeChange,
  onClose,
  onSent,
}: InlineReplyBoxProps) {
  const subject = threadSubject || email.subject || "";
  const prefix = mode === "forward" ? "Fwd: " : "Re: ";
  const prefixedSubject = subject.startsWith(prefix)
    ? subject
    : `${prefix}${subject}`;

  const isReply = mode === "reply" || mode === "reply-all";
  const replyAll = mode === "reply-all"
    ? getReplyAllRecipients(email)
    : null;

  const [to, setTo] = useState(
    isReply
      ? (replyAll?.to || email.from_email || "")
      : ""
  );
  const [cc, setCc] = useState(replyAll?.cc || "");
  const [showCc, setShowCc] = useState(!!replyAll?.cc);
  const [body, setBody] = useState("");
  const [showQuote, setShowQuote] = useState(false);
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quotedHeader = buildQuotedHeader(email);
  const quotedSnippet = email.snippet || "";

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(0, 0);
    }
  }, []);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      const toList = to.split(",").map((e) => ({ email: e.trim() })).filter((p) => p.email);
      const ccList = cc.trim()
        ? cc.split(",").map((e) => ({ email: e.trim() })).filter((p) => p.email)
        : undefined;
      await sendEmail({
        to: toList,
        ...(ccList ? { cc: ccList } : {}),
        subject: prefixedSubject,
        body,
        ...(isReply ? { reply_to_message_id: email.id } : {}),
      });
      onClose();
      onSent?.();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border">
      {/* Header: mode dropdown + To + close */}
      <div className="flex items-center border-b pl-1 pr-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-muted-foreground">
              {mode === "forward" ? (
                <Forward className="size-3.5" />
              ) : mode === "reply-all" ? (
                <ReplyAll className="size-3.5" />
              ) : (
                <Reply className="size-3.5" />
              )}
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onModeChange("reply")}>
              <Reply className="mr-2 size-3.5" />
              Reply
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onModeChange("reply-all")}>
              <ReplyAll className="mr-2 size-3.5" />
              Reply All
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onModeChange("forward")}>
              <Forward className="mr-2 size-3.5" />
              Forward
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="shrink-0 text-sm text-muted-foreground">To</span>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0"
        />
        <div className="flex shrink-0 items-center gap-0.5">
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
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClose}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Cc field */}
      {showCc && (
        <div className="flex items-center border-b px-3">
          <Label className="w-10 shrink-0 text-sm text-muted-foreground">
            Cc
          </Label>
          <Input
            value={cc}
            onChange={(e) => setCc(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0"
          />
        </div>
      )}

      {/* Body */}
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={mode === "forward" ? "Add a message..." : "Write your reply..."}
        className="min-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0"
      />

      {/* Collapsed quoted text */}
      <div className="px-3 pb-2">
        {!showQuote ? (
          <button
            type="button"
            onClick={() => setShowQuote(true)}
            className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
          >
            ···
          </button>
        ) : (
          <div className="border-l-2 border-muted-foreground/30 pl-3 text-xs text-muted-foreground">
            <p className="font-medium">{quotedHeader}</p>
            <p className="mt-1 whitespace-pre-wrap">{quotedSnippet}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <Separator />
      <div className="flex items-center justify-between px-3 py-2">
        <Button
          onClick={handleSend}
          disabled={sending || !to.trim()}
          size="sm"
          className="gap-1.5"
        >
          <Send className="size-3.5" />
          {sending ? "Sending..." : "Send"}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={onClose}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function EmailMessage({ email, threadSubject, onSent }: EmailMessageProps) {
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(null);

  const initials = (email.from_name || email.from_email || "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  return (
    <article className="flex gap-3">
      <Avatar className="size-8 shrink-0 mt-0.5">
        <AvatarFallback className="bg-primary/10 text-primary text-xs">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {email.from_name || email.from_email}
              {email.from_name && (
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">
                  &lt;{email.from_email}&gt;
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              to {email.to_list?.map((r) => r.name || r.email).join(", ")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Reply"
              onClick={() =>
                setComposeMode((m) => (m === "reply" ? null : "reply"))
              }
            >
              <Reply className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Reply All"
              onClick={() =>
                setComposeMode((m) => (m === "reply-all" ? null : "reply-all"))
              }
            >
              <ReplyAll className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              title="Forward"
              onClick={() =>
                setComposeMode((m) => (m === "forward" ? null : "forward"))
              }
            >
              <Forward className="size-3.5" />
            </Button>
            <span className="font-mono text-[11px] text-muted-foreground/70">
              {formatDate(email.received_at)}
            </span>
          </div>
        </div>
        <div className="mt-3 overflow-hidden">
          {email.body_html ? (
            <SandboxedHtml html={email.body_html} />
          ) : (
            <p className="text-sm text-muted-foreground">{email.snippet}</p>
          )}
        </div>

        {/* Inline reply/forward box */}
        {composeMode && (
          <InlineReplyBox
            email={email}
            mode={composeMode}
            threadSubject={threadSubject}
            onModeChange={setComposeMode}
            onClose={() => setComposeMode(null)}
            onSent={onSent}
          />
        )}
      </div>
    </article>
  );
}
