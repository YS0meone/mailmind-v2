"use client";

import { useState } from "react";
import { Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getLabelColor, COLOR_NAMES } from "@/lib/label-colors";
import { cn } from "@/lib/utils";
import type { Label } from "@/types/email";

interface LabelPickerProps {
  labels: Label[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onCreate?: (payload: { name: string; color: string }) => Promise<Label>;
  trigger?: React.ReactNode;
}

export function LabelPicker({ labels, selected, onChange, onCreate, trigger }: LabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !onCreate) return;
    try {
      const label = await onCreate({ name: newName.trim(), color: newColor });
      onChange([...selected, label.id]);
      setNewName("");
      setCreating(false);
    } catch {
      // ignore
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="size-8" title="Labels">
            <Tag className="size-4" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="end">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">Labels</div>
        <div className="max-h-48 overflow-y-auto">
          {labels.map((label) => {
            const colors = getLabelColor(label.color);
            return (
              <div
                key={label.id}
                role="button"
                tabIndex={0}
                onClick={() => toggle(label.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggle(label.id); }}
                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
              >
                <Checkbox
                  checked={selected.includes(label.id)}
                  className="pointer-events-none size-3.5"
                />
                <span className={cn("size-2 rounded-full", colors.dot)} />
                <span className="truncate">{label.name}</span>
              </div>
            );
          })}
        </div>
        {onCreate && (
          <div className="border-t p-2">
            {creating ? (
              <div className="flex flex-col gap-2">
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Label name"
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setCreating(false);
                  }}
                />
                <div className="flex items-center gap-1">
                  {COLOR_NAMES.map((c) => {
                    const colors = getLabelColor(c);
                    return (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          "size-4 rounded-full transition-all",
                          colors.dot,
                          newColor === c && "ring-2 ring-offset-1 ring-foreground/30"
                        )}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs"
                    onClick={() => setCreating(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleCreate}
                    disabled={!newName.trim()}
                  >
                    Add
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Create label
              </button>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
