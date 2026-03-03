"use client";

import { useRef, useEffect, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import type { EmailMessage as EmailMessageType } from "@/types/email";

interface EmailMessageProps {
  email: EmailMessageType;
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

export function EmailMessage({ email }: EmailMessageProps) {
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
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">
            {formatDate(email.received_at)}
          </span>
        </div>
        <div className="mt-3 overflow-hidden">
          {email.body_html ? (
            <SandboxedHtml html={email.body_html} />
          ) : (
            <p className="text-sm text-muted-foreground">{email.snippet}</p>
          )}
        </div>
      </div>
    </article>
  );
}
