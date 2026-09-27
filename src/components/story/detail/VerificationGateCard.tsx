import React from "react";
import { Story } from "@/types/story";
import { ShieldCheck, ShieldX } from "lucide-react";
import { validateStory } from "@/lib/verification";

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

  const gate = validateStory(story);
  const gateMeta = gate.publishable
    ? {
        label: "Gate Passed",
        icon: ShieldCheck,
        tone: "text-emerald-600 dark:text-emerald-400",
        sub: "No deterministic rule violations",
      }
    : {
        label: `Gate Blocked (${gate.issues.length})`,
        icon: ShieldX,
        tone: "text-rose-600 dark:text-rose-400",
        sub: gate.issues[0]?.code ?? "Rule violation",
      };

  return (
    <section className="bg-zinc-50 dark:bg-zinc-900/60 rounded-xl p-4 border border-zinc-200/80 dark:border-zinc-800 space-y-3">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-wider uppercase text-zinc-700 dark:text-zinc-300">
          <gateMeta.icon className={`w-4 h-4 ${gateMeta.tone}`} />
          <span>Verification Gate</span>
        </div>
        <span className={`text-[11px] font-mono ${gateMeta.tone}`}>
          {gateMeta.label}
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

      <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
        {gateMeta.sub} • deterministic rules, no model inference
      </p>

      {!gate.publishable && (
        <ul className="space-y-1 pt-1 border-t border-zinc-200 dark:border-zinc-800">
          {gate.issues.slice(0, 4).map((issue, i) => (
            <li
              key={`${issue.code}-${i}`}
              className="text-[10px] font-mono text-rose-600 dark:text-rose-400 leading-snug"
            >
              {issue.code}
              {issue.claimId ? ` (${issue.claimId})` : ""}
            </li>
          ))}
          {gate.issues.length > 4 && (
            <li className="text-[10px] font-mono text-zinc-500">
              +{gate.issues.length - 4} more
            </li>
          )}
        </ul>
      )}
    </section>
  );
};
