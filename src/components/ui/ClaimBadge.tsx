import React from "react";
import { ClaimStatus } from "@/types/story";
import { CheckCircle2, AlertCircle, HelpCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClaimBadgeProps {
  status: ClaimStatus;
  confidenceScore?: number;
  className?: string;
}

export const ClaimBadge: React.FC<ClaimBadgeProps> = ({
  status,
  confidenceScore,
  className,
}) => {
  switch (status) {
    case "SUPPORTED":
    case "CORROBORATED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Supported</span>
          {confidenceScore !== undefined && (
            <span className="opacity-70 text-[10px] tabular-nums font-mono">
              {Math.round(confidenceScore * 100)}%
            </span>
          )}
        </span>
      );

    case "PARTIALLY_SUPPORTED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-amber-50 text-amber-800 border border-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
            className
          )}
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          <span>Partial</span>
          {confidenceScore !== undefined && (
            <span className="opacity-70 text-[10px] tabular-nums font-mono">
              {Math.round(confidenceScore * 100)}%
            </span>
          )}
        </span>
      );

    case "DISPUTED":
    case "CONTRADICTED":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-rose-50 text-rose-800 border border-rose-200/80 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          <span>Disputed</span>
          {confidenceScore !== undefined && (
            <span className="opacity-70 text-[10px] tabular-nums font-mono">
              {Math.round(confidenceScore * 100)}%
            </span>
          )}
        </span>
      );

    case "UNVERIFIED":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide bg-orange-50 text-orange-800 border border-orange-200/80 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/60",
            className
          )}
        >
          <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
          <span>Unverified</span>
          {confidenceScore !== undefined && (
            <span className="opacity-70 text-[10px] tabular-nums font-mono">
              {Math.round(confidenceScore * 100)}%
            </span>
          )}
        </span>
      );
  }
};
