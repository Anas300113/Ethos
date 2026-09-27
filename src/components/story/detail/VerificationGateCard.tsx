import React from "react";
import { Story } from "@/types/story";
import { ShieldCheck } from "lucide-react";

interface VerificationGateCardProps {
  story: Story;
}

export const VerificationGateCard: React.FC<VerificationGateCardProps> = ({
  story,
}) => {
  const supported = story.claims.filter(
    (c) => c.status === "SUPPORTED" || c.status === "CORROBORATED"
  );
  const disputed = story.claims.filter(
    (c) => c.status === "DISPUTED" || c.status === "CONTRADICTED"
  );
  const unverified = story.claims.filter(
    (c) => c.status === "UNVERIFIED" || c.status === "PARTIALLY_SUPPORTED"
  );

  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/60 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-zinc-700 dark:text-zinc-300">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Verification Gate Results</span>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">
          Deterministic Grounding Pass
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center pt-1">
        <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {supported.length}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Supported
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {unverified.length}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Unverified
          </div>
        </div>
        <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60">
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400">
            {disputed.length}
          </div>
          <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Disputed
          </div>
        </div>
      </div>
    </section>
  );
};
