import React from "react";
import { Claim } from "@/types/story";
import { ClaimBadge } from "@/components/ui/ClaimBadge";
import {
  FileText,
  ExternalLink,
  Quote,
  AlertTriangle,
  Landmark,
  CalendarClock,
} from "lucide-react";

interface ClaimSectionProps {
  claims: Claim[];
}

const MAX_SNIPPET_CHARS = 250;

function truncateSnippet(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_SNIPPET_CHARS) return { text, truncated: false };
  return {
    text: text.slice(0, MAX_SNIPPET_CHARS).trimEnd() + "…",
    truncated: true,
  };
}

export const ClaimSection: React.FC<ClaimSectionProps> = ({ claims }) => {
  return (
    <section className="space-y-3 pt-2" aria-label="Claim verification">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Claim-by-Claim Verification
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          {claims.length} claims tracked
        </span>
      </div>

      <div className="space-y-3">
        {claims.map((claim, claimIndex) => (
          <article
            key={claim.id}
            aria-labelledby={`claim-${claim.id}-heading`}
            className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p
                id={`claim-${claim.id}-heading`}
                className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-snug"
              >
                <span className="mr-1.5 font-mono text-[11px] text-zinc-400">
                  C{claimIndex + 1}
                </span>
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
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {ev.title}
                      </span>
                      {ev.url ? (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open primary source: ${ev.title}`}
                          className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                          <Landmark className="w-3 h-3" />
                          On file
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {ev.issuingBody} • {ev.documentType}
                      {ev.date ? ` • ${ev.date}` : ""}
                    </span>
                    {ev.summary && (
                      <span className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                        {ev.summary}
                      </span>
                    )}
                    {ev.excerpt && (
                      <blockquote className="text-[11px] italic text-zinc-600 dark:text-zinc-300 border-l-2 border-emerald-500 pl-2 mt-1">
                        “{ev.excerpt}”
                      </blockquote>
                    )}
                  </div>
                ))}
              </div>
            )}

            {claim.corroboratingSources &&
              claim.corroboratingSources.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-semibold flex items-center gap-1">
                    <Quote className="w-3 h-3" />
                    <span>
                      Corroborating ({claim.corroboratingSources.length})
                    </span>
                  </div>
                  {claim.corroboratingSources.map((src, i) => {
                    const snippet = truncateSnippet(src.quote);
                    return (
                      <figure
                        key={`${claim.id}-corr-${i}`}
                        className="text-xs p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200/60 dark:border-emerald-900/40 flex flex-col gap-1"
                      >
                        <blockquote className="text-[11px] italic text-zinc-700 dark:text-zinc-300 leading-snug border-l-2 border-emerald-500 pl-2">
                          “{snippet.text}”
                        </blockquote>
                        <figcaption className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
                          <span>
                            {src.publisherName}
                            {snippet.truncated ? " • ≤250 chars" : ""}
                          </span>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Open corroborating source: ${src.publisherName}`}
                            className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white shrink-0"
                          >
                            <span>Source</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              )}

            {claim.disputingSources && claim.disputingSources.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-rose-500 dark:text-rose-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Disputing ({claim.disputingSources.length})</span>
                </div>
                {claim.disputingSources.map((src, i) => {
                  const snippet = truncateSnippet(src.quote);
                  return (
                    <figure
                      key={`${claim.id}-disp-${i}`}
                      className="text-xs p-2.5 rounded-lg bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/60 dark:border-rose-900/40 flex flex-col gap-1.5"
                    >
                      <blockquote className="text-[11px] italic text-zinc-700 dark:text-zinc-300 leading-snug border-l-2 border-rose-500 pl-2">
                        “{snippet.text}”
                      </blockquote>
                      <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                          Dispute:{" "}
                        </span>
                        {src.disputeReason}
                      </p>
                      <figcaption className="flex items-center justify-between gap-2 text-[10px] font-mono text-zinc-500">
                        <span>
                          {src.publisherName}
                          {snippet.truncated ? " • ≤250 chars" : ""}
                        </span>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open disputing source: ${src.publisherName}`}
                          className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white shrink-0"
                        >
                          <span>Source</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}

            <div className="flex items-center gap-1.5 pt-0.5 text-[10px] font-mono text-zinc-400">
              <CalendarClock className="w-3 h-3" />
              <span>
                Last verified{" "}
                {new Date(claim.lastVerified).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </article>
        ))}
      </div>

      {claims.length === 0 && (
        <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 space-y-1.5">
          <FileText className="w-6 h-6 text-zinc-400 mx-auto" />
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            No claims tracked for this story yet
          </p>
          <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
            Discrete claims will appear here once the verification harness
            extracts them from source reporting.
          </p>
        </div>
      )}
    </section>
  );
};
