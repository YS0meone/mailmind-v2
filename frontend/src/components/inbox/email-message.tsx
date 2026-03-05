"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Reply, Forward, Send, Trash2, X } from "lucide-react";
import { formatDate } from "@/lib/format";
import { sendEmail } from "@/lib/api-client";
import type { EmailMessage as EmailMessageType } from "@/types/email";

interface EmailMessageProps {
  email: EmailMessageType;
  threadSubject?: string | null;
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

type ComposeMode = "reply" | "forward";

interface InlineReplyBoxProps {
  email: EmailMessageType;
  mode: ComposeMode;
  threadSubject?: string | null;
  onClose: () => void;
}

function InlineReplyBox({
  email,
  mode,
  threadSubject,
  onClose,
}: InlineReplyBoxProps) {
  const subject = threadSubject || email.subject || "";
  const prefix = mode === "reply" ? "Re: " : "Fwd: ";
  const prefixedSubject = subject.startsWith(prefix)
    ? subject
    : `${prefix}${subject}`;

  const [to, setTo] = useState(
    mode === "reply" ? email.from_email || "" : ""
  );
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    try {
      await sendEmail({
        to: [{ email: to.trim() }],
        subject: prefixedSubject,
        body,
        ...(mode === "reply" ? { reply_to_message_id: email.id } : {}),
      });
      onClose();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const senderDisplay = mode === "reply"
    ? `${email.from_name || email.from_email} (${email.from_email})`
    : "";

  return (
    <div className="mt-4 rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {mode === "reply" ? (
            <Reply className="size-3.5" />
          ) : (
            <Forward className="size-3.5" />
          )}
          <span>{senderDisplay}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onClose}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* To field (editable for forward, shown for reply) */}
      <div className="flex items-center border-b px-3">
        <Label className="w-10 shrink-0 text-sm text-muted-foreground">
          To
        </Label>
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0"
          readOnly={mode === "reply"}
        />
      </div>

      {/* Body */}
      <Textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        className="min-h-[200px] resize-none border-0 shadow-none focus-visible:ring-0"
      />

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

export function EmailMessage({ email, threadSubject }: EmailMessageProps) {
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
            onClose={() => setComposeMode(null)}
          />
        )}
      </div>
    </article>
  );
}
