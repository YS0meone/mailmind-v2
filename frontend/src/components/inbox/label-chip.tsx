import { cn } from "@/lib/utils";
import { getLabelColor } from "@/lib/label-colors";
import type { LabelBrief } from "@/types/email";

interface LabelChipProps {
  label: LabelBrief;
  className?: string;
}

export function LabelChip({ label, className }: LabelChipProps) {
  const colors = getLabelColor(label.color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none",
        colors.bg,
        colors.text,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full", colors.dot)} />
      {label.name}
    </span>
  );
}
