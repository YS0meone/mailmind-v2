"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLabelColor, COLOR_NAMES } from "@/lib/label-colors";
import { cn } from "@/lib/utils";
import type { Label } from "@/types/email";

interface LabelManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: Label[];
  onUpdate: (id: string, payload: { name?: string; color?: string; description?: string }) => Promise<Label>;
  onDelete: (id: string) => Promise<void>;
  onCreate: (payload: { name: string; color: string; description?: string }) => Promise<Label>;
}

export function LabelManagerDialog({
  open,
  onOpenChange,
  labels,
  onUpdate,
  onDelete,
  onCreate,
}: LabelManagerDialogProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");

  const startEdit = (label: Label) => {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditColor("");
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await onUpdate(editingId, { name: editName.trim(), color: editColor });
    cancelEdit();
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await onCreate({ name: newName.trim(), color: newColor });
    setNewName("");
    setNewColor("blue");
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Labels</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1 max-h-80 overflow-y-auto">
          {labels.map((label) => {
            const colors = getLabelColor(label.color);
            const isEditing = editingId === label.id;

            if (isEditing) {
              return (
                <div key={label.id} className="flex flex-col gap-2 rounded-md border p-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit();
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <div className="flex items-center gap-1">
                    {COLOR_NAMES.map((c) => {
                      const cc = getLabelColor(c);
                      return (
                        <button
                          key={c}
                          onClick={() => setEditColor(c)}
                          className={cn(
                            "size-5 rounded-full transition-all",
                            cc.dot,
                            editColor === c && "ring-2 ring-offset-1 ring-foreground/30"
                          )}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-7" onClick={cancelEdit}>
                      <X className="size-3.5" />
                    </Button>
                    <Button size="sm" className="h-7" onClick={saveEdit} disabled={!editName.trim()}>
                      <Check className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={label.id}
                className="group/item flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <span className={cn("size-2.5 shrink-0 rounded-full", colors.dot)} />
                <span className="flex-1 text-sm truncate">{label.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(label)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    title="Edit"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => onDelete(label.id)}
                    className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title="Delete"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create new label */}
        <div className="border-t pt-3">
          {creating ? (
            <div className="flex flex-col gap-2">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New label name"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
              />
              <div className="flex items-center gap-1">
                {COLOR_NAMES.map((c) => {
                  const cc = getLabelColor(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "size-5 rounded-full transition-all",
                        cc.dot,
                        newColor === c && "ring-2 ring-offset-1 ring-foreground/30"
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreate} disabled={!newName.trim()}>
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setCreating(true)}
            >
              <span className="mr-1.5">+</span> New Label
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
