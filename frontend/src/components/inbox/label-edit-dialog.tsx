"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLabelColor, COLOR_NAMES } from "@/lib/label-colors";
import { cn } from "@/lib/utils";
import type { Label } from "@/types/email";

interface LabelEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: Label | null;
  onSave: (
    id: string,
    payload: {
      name?: string;
      color?: string;
      description?: string;
      rules?: Record<string, unknown> | null;
    }
  ) => Promise<Label>;
  onCreate: (payload: {
    name: string;
    color: string;
    description?: string;
    rules?: Record<string, unknown> | null;
  }) => Promise<Label>;
  onDelete: (id: string) => Promise<void>;
}

export function LabelEditDialog({
  open,
  onOpenChange,
  label,
  onSave,
  onCreate,
  onDelete,
}: LabelEditDialogProps) {
  const isNew = !label;
  const [name, setName] = useState("");
  const [color, setColor] = useState("blue");
  const [description, setDescription] = useState("");
  const [rulesText, setRulesText] = useState("");
  const [rulesError, setRulesError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (label) {
        setName(label.name);
        setColor(label.color);
        setDescription(label.description || "");
        setRulesText(label.rules ? JSON.stringify(label.rules, null, 2) : "");
      } else {
        setName("");
        setColor("blue");
        setDescription("");
        setRulesText("");
      }
      setRulesError("");
    }
  }, [open, label]);

  const parseRules = (): Record<string, unknown> | null | undefined => {
    const trimmed = rulesText.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      setRulesError("");
      return parsed;
    } catch {
      setRulesError("Invalid JSON");
      return undefined;
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    const rules = parseRules();
    if (rules === undefined) return;

    setSaving(true);
    try {
      if (label) {
        await onSave(label.id, {
          name: name.trim(),
          color,
          description: description.trim() || undefined,
          rules,
        });
      } else {
        await onCreate({
          name: name.trim(),
          color,
          description: description.trim() || undefined,
          rules,
        });
      }
      onOpenChange(false);
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!label) return;
    await onDelete(label.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? "New Label" : "Edit Label"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Label name"
              className="h-9"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>

          {/* Color */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <div className="flex items-center gap-1.5">
              {COLOR_NAMES.map((c) => {
                const cc = getLabelColor(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "size-6 rounded-full transition-all",
                      cc.dot,
                      color === c && "ring-2 ring-offset-2 ring-foreground/30"
                    )}
                    title={c}
                  />
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Description
              <span className="ml-1 font-normal text-muted-foreground/60">
                (used as context for AI triage)
              </span>
            </label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Work-related emails, meetings, projects"
              className="h-9"
            />
          </div>

          {/* Rules */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Rules
              <span className="ml-1 font-normal text-muted-foreground/60">
                (JSON, for auto-classification)
              </span>
            </label>
            <Textarea
              value={rulesText}
              onChange={(e) => {
                setRulesText(e.target.value);
                setRulesError("");
              }}
              placeholder={`{\n  "conditions": [\n    { "field": "from_email", "op": "contains", "value": "@company.com" }\n  ],\n  "match": "any"\n}`}
              className="min-h-24 font-mono text-xs"
            />
            {rulesError && (
              <span className="text-xs text-destructive">{rulesError}</span>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2">
          {label ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDelete}
            >
              <Trash2 className="mr-1.5 size-3.5" />
              Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!name.trim() || saving}>
              {isNew ? "Create" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
