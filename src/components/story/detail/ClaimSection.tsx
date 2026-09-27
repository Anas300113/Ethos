import React from "react";
import { Claim } from "@/types/story";
import { ClaimBadge } from "@/components/ui/ClaimBadge";
import { FileText, ExternalLink } from "lucide-react";

interface ClaimSectionProps {
  claims: Claim[];
}

export const ClaimSection: React.FC<ClaimSectionProps> = ({ claims }) => {
  return (
    <section className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Claim-by-Claim Verification
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          {claims.length} claims tracked
        </span>
      </div>

      <div className="space-y-3">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug">
                “{claim.statement}”
              </p>
              <ClaimBadge
                status={claim.status}
                confidenceScore={claim.confidenceScore}
              />
            </div>

            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-zinc-50 dark:bg-zinc-800/40 p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
              <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                Audit:{" "}
              </span>
              {claim.explanation}
            </p>

            {claim.primaryEvidence && claim.primaryEvidence.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>Primary Evidence Grounding</span>
                </div>
                {claim.primaryEvidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="text-xs p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {ev.title}
                      </span>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {ev.issuingBody} • {ev.documentType}
                    </span>
                    {ev.excerpt && (
                      <blockquote className="text-[11px] italic text-zinc-600 dark:text-zinc-300 border-l-2 border-emerald-500 pl-2 mt-1">
                        “{ev.excerpt}”
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
