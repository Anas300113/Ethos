import React from "react";
import { SourceComparisonItem, TimelineEvent, ArticleSource } from "@/types/story";
import { Layers, History, ExternalLink, Clock3 } from "lucide-react";
import { StanceLabel } from "@/components/ui/StanceLabel";
import { resolveStance } from "@/lib/stance";

interface AnalysisSectionsProps {
  whereSourcesDiffer: SourceComparisonItem[];
  timeline: TimelineEvent[];
  sources: ArticleSource[];
}

export const AnalysisSections: React.FC<AnalysisSectionsProps> = ({
  whereSourcesDiffer,
  timeline,
  sources,
}) => {
  return (
    <div className="space-y-6">
      {/* Reporting Stance Comparison */}
      {whereSourcesDiffer && whereSourcesDiffer.length > 0 && (
        <section className="space-y-3 pt-2" aria-label="Source stance comparison">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              <span>Multi-Source Stance Comparison</span>
            </h2>
          </div>

          <div className="space-y-3">
            {whereSourcesDiffer.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3"
              >
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wide">
                  {item.topic}
                </h3>
                <div className="space-y-2">
                  {item.points.map((pt, i) => {
                    const stance = resolveStance(pt);
                    return (
                      <div
                        key={i}
                        className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 font-mono">
                            {pt.sourceName}
                          </span>
                          <StanceLabel stance={stance} />
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-300 leading-snug">
                          {pt.reporting}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Verified Timeline */}
      {timeline && timeline.length > 0 && (
        <section className="space-y-3 pt-2" aria-label="Event chronology">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              <History className="w-3.5 h-3.5" />
              <span>Chronology of Events</span>
            </div>
            <span className="text-[11px] font-mono text-zinc-400">
              {timeline.length} events
            </span>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <ol className="relative pl-4 border-l border-zinc-200 dark:border-zinc-800 space-y-4">
              {timeline.map((event, eventIndex) => (
                <li key={event.id} className="relative group">
                  <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700 group-hover:bg-zinc-900 dark:group-hover:bg-white transition-colors" />
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                      <Clock3 className="w-3 h-3" />
                      <span>
                        E{eventIndex + 1} • {event.displayTime}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-800 dark:text-zinc-200 leading-snug">
                      {event.eventText}
                    </p>
                    {event.sourceName && (
                      <span className="text-[10px] font-mono text-zinc-500">
                        {event.sourceUrl ? (
                          <a
                            href={event.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-zinc-900 dark:hover:text-white hover:underline"
                          >
                            Via {event.sourceName}
                          </a>
                        ) : (
                          <>Via {event.sourceName}</>
                        )}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {!timeline ||
        (timeline.length === 0 && (
          <div className="text-center py-8 bg-white dark:bg-zinc-900 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 space-y-1.5">
            <History className="w-6 h-6 text-zinc-400 mx-auto" />
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              No timeline events published yet
            </p>
          </div>
        ))}

      {/* Sources & Fair-Use Citations */}
      {sources && sources.length > 0 && (
        <section className="space-y-3 pt-2">
          <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
            Source Index & Attribution ({sources.length} outlets)
          </h2>
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/80 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {sources.map((src) => (
              <div
                key={src.id}
                className="p-3.5 flex items-center justify-between hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="space-y-0.5 pr-4">
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline flex items-center gap-1.5"
                  >
                    <span>{src.title}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-400 inline shrink-0" />
                  </a>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                    <span>{src.publisher.name}</span>
                    <span>•</span>
                    <span>Tier: {src.publisher.tier}</span>
                    {src.author && (
                      <>
                        <span>•</span>
                        <span>By {src.author}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
