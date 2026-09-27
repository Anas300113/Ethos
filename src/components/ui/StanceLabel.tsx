import React from "react";
import { SourceStance } from "@/types/story";
import { CheckCircle2, PlusCircle, XCircle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StanceLabelProps {
  stance: SourceStance;
  className?: string;
}

const STANCE_META: Record<
  SourceStance,
  { label: string; icon: React.ComponentType<{ className?: string }>; styles: string }
> = {
  CONFIRMS: {
    label: "Confirms",
    icon: CheckCircle2,
    styles:
      "bg-emerald-50 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
  },
  ADDS_CONTEXT: {
    label: "Adds context",
    icon: PlusCircle,
    styles:
      "bg-sky-50 text-sky-800 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
  },
  DISPUTES: {
    label: "Disputes",
    icon: XCircle,
    styles:
      "bg-rose-50 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
  },
  OMITS: {
    label: "Omits",
    icon: MinusCircle,
    styles:
      "bg-zinc-100 text-zinc-600 border-zinc-200/80 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700/60",
  },
};

export function inferStance(reporting: string): SourceStance {
  const text = reporting.toLowerCase();
  if (
    text.includes("warn") ||
    text.includes("caution") ||
    text.includes("unlikely") ||
    text.includes("dispute") ||
    text.includes("friction") ||
    text.includes("shortfall") ||
    text.includes("only adhere") ||
    text.includes("sidelines")
  ) {
    return "DISPUTES";
  }
  if (
    text.includes("focus") ||
    text.includes("emphasi") ||
    text.includes("highlight") ||
    text.includes("emotional") ||
    text.includes("mechanic")
  ) {
    return "ADDS_CONTEXT";
  }
  return "CONFIRMS";
}

export const StanceLabel: React.FC<StanceLabelProps> = ({ stance, className }) => {
  const meta = STANCE_META[stance];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border",
        meta.styles,
        className
      )}
    >
      <Icon className="w-3 h-3" />
      <span>{meta.label}</span>
    </span>
  );
};
