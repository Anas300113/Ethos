import React from "react";
import { Story } from "@/types/story";
import { CheckCircle2, AlertTriangle, Scale } from "lucide-react";

interface NarrativeSectionProps {
  story: Story;
}

export const NarrativeSection: React.FC<NarrativeSectionProps> = ({
  story,
}) => {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
          What Happened
        </h2>
        <div className="font-editorial text-base text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-line bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/70 dark:border-zinc-800">
          {story.whatHappened}
        </div>
      </div>

      <div>
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2">
          Why It Matters
        </h2>
        <div className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800">
          {story.whyItMatters}
        </div>
      </div>

      {story.sourcesAgreeOn && story.sourcesAgreeOn.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
            <Scale className="w-3.5 h-3.5 text-zinc-500" />
            <span>Where Sources Agree ({story.sourcesAgreeOn.length})</span>
          </div>
          <ul className="text-xs space-y-2 text-zinc-700 dark:text-zinc-300">
            {story.sourcesAgreeOn.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 leading-snug">
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 pt-1">
        <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/40 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>What We Know</span>
          </div>
          <ul className="text-xs space-y-2 text-zinc-700 dark:text-zinc-300 list-disc list-inside">
            {story.whatWeKnow.map((item, idx) => (
              <li key={idx} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>What Is Unclear</span>
          </div>
          <ul className="text-xs space-y-2 text-zinc-700 dark:text-zinc-300 list-disc list-inside">
            {story.whatIsUnclear.map((item, idx) => (
              <li key={idx} className="leading-snug">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
