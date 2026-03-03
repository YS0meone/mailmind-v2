"use client";

import { useState } from "react";
import { sendEmail } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Send } from "lucide-react";

interface ComposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeDialog({ open, onOpenChange }: ComposeDialogProps) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!to || !subject) return;
    setSending(true);
    try {
      await sendEmail({
        to: [{ email: to.trim() }],
        subject,
        body,
      });
      onOpenChange(false);
      setTo("");
      setSubject("");
      setBody("");
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New message</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Input
            placeholder="To"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="font-mono text-sm"
          />
          <Input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            placeholder="Write your message..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            className="resize-none"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSend}
              disabled={sending || !to || !subject}
              size="sm"
              className="gap-1.5"
            >
              <Send className="size-3.5" />
              {sending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
