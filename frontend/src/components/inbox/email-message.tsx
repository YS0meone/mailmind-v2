"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Reply, ReplyAll, Forward, Send, Trash2, X, ChevronDown, Sparkles } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { sendEmail } from "@/lib/api-client";
import { useDraftAutosave } from "@/hooks/use-draft-autosave";
import { RecipientInput } from "./recipient-input";
import { AiComposeModal } from "./ai-compose-modal";
import type { Participant, EmailMessage as EmailMessageType, Draft } from "@/types/email";

interface EmailMessageProps {
  email: EmailMessageType;
  threadEmails?: EmailMessageType[];
  threadSubject?: string | null;
  onSent?: () => void;
  pendingDraft?: Draft | null;
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

function buildForwardedMessage(email: EmailMessageType): string {
  const date = email.received_at
    ? new Date(email.received_at).toLocaleString()
    : "";
  const from = email.from_name
    ? `${email.from_name} <${email.from_email}>`
    : email.from_email || "";
  const toStr = email.to_list?.map((p) => p.name ? `${p.name} <${p.email}>` : p.email).join(", ") || "";
  const lines = [
    `From: ${from}`,
    `Date: ${date}`,
    `Subject: ${email.subject || ""}`,
    `To: ${toStr}`,
  ];
  if (email.cc_list?.length) {
    const ccStr = email.cc_list.map((p) => p.name ? `${p.name} <${p.email}>` : p.email).join(", ");
    lines.push(`Cc: ${ccStr}`);
  }
  lines.push("", email.snippet || "");
  return lines.join("\n");
}

function buildForwardedBlock(emails: EmailMessageType[]): string {
  const sorted = [...emails].sort(
    (a, b) => new Date(a.received_at || 0).getTime() - new Date(b.received_at || 0).getTime()
  );
  const parts = sorted.map((e) => buildForwardedMessage(e));
  return "---------- Forwarded message ----------\n" + parts.join("\n\n---\n\n");
}

function getReplyAllRecipients(
  email: EmailMessageType,
  userEmail?: string
): { to: Participant[]; cc: Participant[] } {
  // To: original sender
  const toList: Participant[] = email.from_email
    ? [{ email: email.from_email, name: email.from_name || undefined }]
    : [];
  // Cc: original to + cc, excluding the user and the sender
  const exclude = new Set(
    [userEmail, email.from_email].filter(Boolean).map((e) => e!.toLowerCase())
  );
  const seen = new Set<string>();
  const ccList: Participant[] = [];
  for (const p of [...(email.to_list || []), ...(email.cc_list || [])]) {
    const lower = p.email.toLowerCase();
    if (!exclude.has(lower) && !seen.has(lower)) {
      seen.add(lower);
      ccList.push(p);
    }
  }
  return { to: toList, cc: ccList };
}

interface InlineReplyBoxProps {
  email: EmailMessageType;
  threadEmails: EmailMessageType[];
  mode: ComposeMode;
  threadSubject?: string | null;
  onModeChange: (mode: ComposeMode) => void;
  onClose: () => void;
  onSent?: () => void;
  initialDraft?: Draft | null;
}

function InlineReplyBox({
  email,
  threadEmails,
  mode,
  threadSubject,
  onModeChange,
  onClose,
  onSent,
  initialDraft,
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

  const defaultTo: Participant[] = isReply
    ? (replyAll?.to || (email.from_email ? [{ email: email.from_email, name: email.from_name || undefined }] : []))
    : [];
  const defaultCc: Participant[] = replyAll?.cc || [];

  const [to, setTo] = useState<Participant[]>(initialDraft?.to_list ?? defaultTo);
  const [cc, setCc] = useState<Participant[]>(initialDraft?.cc_list ?? defaultCc);
  const [showCc, setShowCc] = useState((initialDraft?.cc_list?.length ?? defaultCc.length) > 0);
  const [body, setBody] = useState(initialDraft?.body ?? "");
  const [showQuote, setShowQuote] = useState(false);
  const [sending, setSending] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const quotedHeader = buildQuotedHeader(email);
  const quotedSnippet = email.snippet || "";

  const { draftId, saveStatus, scheduleSave, discard } = useDraftAutosave({
    initialDraftId: initialDraft?.id,
    mode,
    replyToMessageId: isReply ? email.id : undefined,
    threadId: email.thread_id ?? undefined,
  });

  // Auto-save on content changes
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      if (!initialDraft) return;
    }
    const hasContent = to.length > 0 || body.trim();
    if (hasContent) {
      scheduleSave({ subject: prefixedSubject, body, to, cc, bcc: [] });
    }
  }, [to, cc, body, scheduleSave, prefixedSubject, initialDraft]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.focus();
      ta.setSelectionRange(0, 0);
    }
  }, []);

  const handleSend = async () => {
    if (to.length === 0) return;
    setSending(true);
    try {
      const fullBody = mode === "forward"
        ? `${body}\n\n${buildForwardedBlock(threadEmails)}`
        : body;
      await sendEmail({
        to,
        ...(cc.length > 0 ? { cc } : {}),
        subject: prefixedSubject,
        body: fullBody,
        ...(isReply ? { reply_to_message_id: email.id } : {}),
        draft_id: draftId ?? undefined,
      });
      onClose();
      onSent?.();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const handleDiscard = async () => {
    await discard();
    onClose();
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
        <span className="shrink-0 pr-1 text-sm text-muted-foreground">To</span>
        <RecipientInput value={to} onChange={setTo} />
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
          <RecipientInput value={cc} onChange={setCc} />
        </div>
      )}

      {/* Body */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === "m") {
              e.preventDefault();
              setAiModalOpen(true);
            }
          }}
          placeholder={mode === "forward" ? "Add a message..." : "Write your reply... (Ctrl+M for AI)"}
          className="min-h-[120px] resize-none border-0 shadow-none focus-visible:ring-0"
        />
        <AiComposeModal
          open={aiModalOpen}
          onClose={() => setAiModalOpen(false)}
          onAccept={(text) => setBody(text)}
          threadSubject={threadSubject}
          threadSnippet={email.snippet}
          senderName={email.from_name || email.from_email}
        />
      </div>

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
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSend}
            disabled={sending || to.length === 0}
            size="sm"
            className="gap-1.5"
          >
            <Send className="size-3.5" />
            {sending ? "Sending..." : "Send"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            title="AI Compose (Ctrl+M)"
            onClick={() => setAiModalOpen(true)}
          >
            <Sparkles className="size-3.5" />
          </Button>
          {saveStatus !== "idle" && (
            <span className="text-[11px] text-muted-foreground/70">
              {saveStatus === "saving" ? "Saving..." : "Draft saved"}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground"
          onClick={handleDiscard}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function EmailMessage({ email, threadEmails, threadSubject, onSent, pendingDraft }: EmailMessageProps) {
  const [composeMode, setComposeMode] = useState<ComposeMode | null>(
    pendingDraft ? (pendingDraft.mode as ComposeMode) : null
  );

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
            threadEmails={threadEmails || [email]}
            mode={composeMode}
            threadSubject={threadSubject}
            onModeChange={setComposeMode}
            onClose={() => setComposeMode(null)}
            onSent={onSent}
            initialDraft={pendingDraft?.mode === composeMode ? pendingDraft : null}
          />
        )}
      </div>
    </article>
  );
}
