import React from "react";
import { StoryUpdate } from "@/types/story";
import { History, AlertTriangle, ExternalLink, Clock3 } from "lucide-react";

interface CorrectionsSectionProps {
  updates: StoryUpdate[];
}

type UpdateKind = NonNullable<StoryUpdate["kind"]>;

/**
 * Every row here was written by the pipeline and never edited afterwards: a
 * story's history is append-only. A CORRECTION is shown louder than an update
 * on purpose — a claim that weakened is the reader's business, not an
 * editorial embarrassment to smooth over.
 */
const KIND_META: Record<UpdateKind, { label: string; chip: string }> = {
  PUBLISHED: {
    label: "Published",
    chip: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  },
  CONTENT_UPDATE: {
    label: "Updated",
    chip: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  },
  CLAIM_REASSESSED: {
    label: "Re-assessed",
    chip: "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  },
  CORRECTION: {
    label: "Correction",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  },
};

function timestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export const CorrectionsSection: React.FC<CorrectionsSectionProps> = ({
  updates,
}) => {
  const corrections = updates.filter(
    (update) => update.kind === "CORRECTION"
  ).length;

  return (
    <section className="space-y-3 pt-2" aria-label="Corrections and updates">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" />
          <span>Corrections &amp; Updates</span>
        </h2>
        <span className="text-[11px] font-mono text-zinc-400">
          {corrections > 0
            ? `${corrections} ${corrections === 1 ? "correction" : "corrections"}`
            : "history is append-only"}
        </span>
      </div>

      {updates.length === 0 ? (
        <div className="text-[11px] text-zinc-500 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-3">
          Nothing has been corrected or re-assessed since this story was
          published.
        </div>
      ) : (
        <ol className="space-y-2">{updates.map(renderUpdate)}</ol>
      )}
    </section>
  );
};

function renderUpdate(update: StoryUpdate) {
  const meta = KIND_META[update.kind ?? "CONTENT_UPDATE"];
  return (
    <li
      key={update.id}
      className="bg-white dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-1.5"
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider font-semibold ${meta.chip}`}
        >
          {update.kind === "CORRECTION" && <AlertTriangle className="w-3 h-3" />}
          {meta.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-zinc-400">
          <Clock3 className="w-3 h-3" />
          {timestamp(update.timestamp)}
        </span>
      </div>

      <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-snug">
        {update.whatChanged}
      </p>

      {update.reason && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-snug">
          <span className="font-semibold text-zinc-700 dark:text-zinc-300">
            Why:{" "}
          </span>
          {update.reason}
        </p>
      )}

      {(update.previousState || update.newState) && (
        <p className="text-[11px] font-mono leading-snug text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/40 p-2 rounded-lg border border-zinc-100 dark:border-zinc-800">
          {update.previousState && (
            <span className="line-through decoration-rose-400/70">
              {update.previousState}
            </span>
          )}
          {update.previousState && update.newState ? " → " : ""}
          {update.newState && (
            <span className="text-zinc-900 dark:text-zinc-100">{update.newState}</span>
          )}
        </p>
      )}

      {update.claimStatement && (
        <p className="text-[10px] font-mono text-zinc-500">
          Claim: “{update.claimStatement}”
        </p>
      )}

      {(update.sourceLabel || update.evidenceUrl) && (
        <p className="text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
          <span>
            {update.sourceLabel
              ? `Changed by ${update.sourceLabel}`
              : "Changed by a new source"}
          </span>
          {update.evidenceUrl && (
            <a
              href={update.evidenceUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open the reporting behind this change"
              className="inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-white"
            >
              <span>Source</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </p>
      )}
    </li>
  );
}
