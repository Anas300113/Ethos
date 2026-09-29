import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NarrativeSection } from "@/components/story/detail/NarrativeSection";
import { ClaimSection } from "@/components/story/detail/ClaimSection";
import { AnalysisSections } from "@/components/story/detail/AnalysisSections";
import { StoryCard } from "@/components/story/StoryCard";
import { SaveButton } from "@/components/story/SaveButton";
import { TopicFollowButton } from "@/components/story/TopicFollowButton";
import { RecordRead } from "@/components/system/RecordRead";
import { getStoryBySlug, getRelatedStories } from "@/lib/stories/dal";
import {
  getFollowedTopics,
  getReaderId,
  getSavedStoryRefs,
} from "@/lib/reader";

// A published story is live database state with a developing flag; a
// prerendered snapshot would go stale inside the hour.
export const dynamic = "force-dynamic";

interface StoryPageProps {
  params: Promise<{ slug: string }>;
}

function publishedOn(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const readerId = await getReaderId();
  const [related, savedRefs, followedTopics] = await Promise.all([
    getRelatedStories(story),
    readerId ? getSavedStoryRefs(readerId) : Promise.resolve([]),
    getFollowedTopics(readerId),
  ]);
  const saved = savedRefs.find((ref) => ref.slug === story.slug);
  const publisherNames = [
    ...new Set(story.sources.map((source) => source.publisher.name)),
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8">
      <RecordRead slug={story.slug} />

      <div className="flex items-center justify-between text-xs">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </Link>
        <SaveButton
          slug={story.slug}
          saved={Boolean(saved)}
          updatedSinceSaved={saved?.updatedSinceSaved}
        />
      </div>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
            {story.topic}
          </span>
          <TopicFollowButton
            topic={story.topic}
            followed={followedTopics.includes(story.topic)}
          />
          {story.isDeveloping && (
            <span className="text-zinc-500">Developing story</span>
          )}
        </div>

        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 leading-tight">
          {story.headline}
        </h1>

        <p className="text-base text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
          {story.oneSentenceSummary}
        </p>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {publisherNames.join(", ")} · {story.sources.length} sources ·{" "}
          {story.readingTimeMinutes} min read · updated{" "}
          {publishedOn(story.lastUpdated)}
        </p>

        {story.heroImageUrl && (
          <figure className="rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.heroImageUrl}
              alt={story.heroImageCaption || story.headline}
              className="w-full h-56 object-cover"
            />
            {story.heroImageCaption && (
              <figcaption className="p-2.5 text-[11px] text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900">
                {story.heroImageCaption}
              </figcaption>
            )}
          </figure>
        )}
      </header>

      <NarrativeSection story={story} />

      <ClaimSection claims={story.claims} />

      <AnalysisSections
        whereSourcesDiffer={story.whereSourcesDiffer}
        timeline={story.timeline}
        sources={story.sources}
      />

      {related.length > 0 && (
        <section className="space-y-4 pt-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200/80 dark:border-zinc-800 pb-2">
            More in {story.topic}
          </h2>
          {related.map((item) => (
            <StoryCard key={item.id} story={item} />
          ))}
        </section>
      )}
    </div>
  );
}
