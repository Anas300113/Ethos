import React from "react";
import Link from "next/link";
import { Story } from "@/types/story";

interface StoryCardProps {
  story: Story;
  /** Hero variant leads the home page: larger type, no image chrome. */
  variant?: "standard" | "hero";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - Date.parse(iso);
  const minutes = Math.max(1, Math.round(diffMs / 60000));
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} d ago`;
}

/** Plain-language evidence indicator — no percentages, no developer labels. */
function evidenceSummary(story: Story): string | null {
  const established = story.claims.filter(
    (claim) => claim.status === "SUPPORTED" || claim.status === "CORROBORATED"
  ).length;
  const unverified = story.claims.filter(
    (claim) => claim.status === "UNVERIFIED"
  ).length;
  const disputed = story.claims.filter(
    (claim) => claim.status === "DISPUTED" || claim.status === "CONTRADICTED"
  ).length;
  if (disputed > 0) return "Sources disagree";
  if (established > 0 && unverified === 0) return "Backed by primary evidence";
  if (established > 0) return `${established} of ${story.claims.length} claims evidence-backed`;
  return "Reported, not yet confirmed";
}

export const StoryCard: React.FC<StoryCardProps> = ({ story, variant = "standard" }) => {
  const isHero = variant === "hero";
  const evidence = evidenceSummary(story);

  return (
    <article className="group">
      {story.heroImageUrl && (
        <Link
          href={`/story/${story.slug}`}
          className="block relative mb-3 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={story.heroImageUrl}
            alt=""
            className={`w-full object-cover ${isHero ? "h-64 sm:h-80" : "h-44"}`}
          />
        </Link>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          <span>{story.topic}</span>
          {story.isDeveloping && (
            <>
              <span aria-hidden>·</span>
              <span>Developing</span>
            </>
          )}
        </div>

        <h3
          className={`font-editorial font-bold tracking-tight text-zinc-950 dark:text-zinc-50 leading-tight ${
            isHero ? "text-2xl sm:text-3xl" : "text-xl"
          }`}
        >
          <Link
            href={`/story/${story.slug}`}
            className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {story.headline}
          </Link>
        </h3>

        <p
          className={`text-zinc-600 dark:text-zinc-300 leading-relaxed ${
            isHero ? "text-base" : "text-sm"
          }`}
        >
          {story.oneSentenceSummary}
        </p>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {story.sources.length} sources · {relativeTime(story.lastUpdated)} ·{" "}
          {story.readingTimeMinutes} min
          {evidence && (
            <>
              {" "}
              · <span className="text-zinc-600 dark:text-zinc-300">{evidence}</span>
            </>
          )}
        </p>
      </div>
    </article>
  );
};

