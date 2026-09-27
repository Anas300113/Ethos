import React from "react";
import Link from "next/link";
import { Story } from "@/types/story";
import { ClaimBadge } from "@/components/ui/ClaimBadge";
import { Clock, BookOpen, Layers } from "lucide-react";

interface StoryCardProps {
  story: Story;
}

export const StoryCard: React.FC<StoryCardProps> = ({ story }) => {
  const verifiedCount = story.claims.filter(
    (c) => c.status === "SUPPORTED" || c.status === "CORROBORATED"
  ).length;

  return (
    <article className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col">
      {story.heroImageUrl && (
        <Link
          href={`/story/${story.slug}`}
          className="relative h-48 w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 block"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.heroImageUrl}
            alt={story.headline}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
          />
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-zinc-900/90 text-white backdrop-blur-sm">
              {story.topic}
            </span>
          </div>
        </Link>
      )}

      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400 mb-2.5">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>{story.readingTimeMinutes} min read</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>{story.sources.length} sources analyzed</span>
          </span>
        </div>

        <Link href={`/story/${story.slug}`} className="block">
          <h2 className="font-editorial text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-50 leading-snug tracking-tight hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors mb-2">
            {story.headline}
          </h2>
        </Link>

        <p className="text-zinc-600 dark:text-zinc-300 text-sm leading-relaxed mb-4 line-clamp-3">
          {story.oneSentenceSummary}
        </p>

        {/* Claim Grounding Bar */}
        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 dark:text-zinc-500 font-semibold">
              Grounding Status ({verifiedCount}/{story.claims.length} verified)
            </span>
            <Link
              href={`/story/${story.slug}`}
              className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1 hover:underline"
            >
              <span>View Dossier</span>
              <BookOpen className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {story.claims.slice(0, 2).map((claim) => (
              <ClaimBadge
                key={claim.id}
                status={claim.status}
                confidenceScore={claim.confidenceScore}
                className="text-[11px] py-0.5"
              />
            ))}
            {story.claims.length > 2 && (
              <span className="text-xs font-mono text-zinc-400 dark:text-zinc-500 self-center pl-1">
                +{story.claims.length - 2} more
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
};
