"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { streamChat } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Minus, X, Send, RotateCcw, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AiChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  composeOpen?: boolean;
}

export function AiChatPanel({ open, onOpenChange, composeOpen }: AiChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setStreaming(true);

    // Add empty assistant message for streaming
    const assistantMsg: ChatMessage = { role: "assistant", content: "" };
    setMessages([...newMessages, assistantMsg]);

    const controller = streamChat(
      newMessages.map((m) => ({ role: m.role, content: m.content })),
      (token) => {
        assistantMsg.content += token;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg };
          return updated;
        });
      },
      () => {
        setStreaming(false);
      },
      (err) => {
        assistantMsg.content += assistantMsg.content
          ? `\n\n*Error: ${err}*`
          : `*Error: ${err}*`;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg };
          return updated;
        });
        setStreaming(false);
      },
    );

    abortRef.current = controller;
  }, [input, streaming, messages]);

  const handleNewChat = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, []);

  const handleClose = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    onOpenChange(false);
    setMinimized(false);
    setMessages([]);
    setInput("");
    setStreaming(false);
  }, [onOpenChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed bottom-0 z-50 flex w-[440px] flex-col rounded-t-lg border border-b-0 bg-background shadow-xl",
        minimized ? "" : "h-[560px]",
      )}
      style={{ right: composeOpen ? "580px" : "24px" }}
    >
      {/* Header */}
      <div
        className="flex h-10 shrink-0 cursor-pointer items-center justify-between rounded-t-lg bg-primary px-3"
        onClick={() => setMinimized((m) => !m)}
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary-foreground" />
          <span className="text-sm font-medium text-primary-foreground">Ask AI</span>
        </div>
        <div className="flex items-center gap-0.5">
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleNewChat();
                  }}
                >
                  <RotateCcw className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">New chat</TooltipContent>
            </Tooltip>
          )}
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

      {/* Body */}
      {!minimized && (
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center text-center">
                <div className="space-y-2 text-muted-foreground">
                  <MessageSquare className="mx-auto size-8 opacity-40" />
                  <p className="text-sm">Ask me anything about your emails</p>
                  <p className="text-xs opacity-70">
                    &ldquo;Show me unread emails from last week&rdquo;
                  </p>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {msg.content || (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t px-3 py-2">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your emails..."
                disabled={streaming}
                rows={1}
                className="flex-1 resize-none rounded-lg border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
                style={{ maxHeight: "80px" }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 80) + "px";
                }}
              />
              <Button
                size="icon"
                className="size-8 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || streaming}
              >
                {streaming ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
