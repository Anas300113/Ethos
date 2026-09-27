import { notFound } from "next/navigation";
import { getStoryBySlug, getAllStories } from "@/data/mockStories";
import { VerificationGateCard } from "@/components/story/detail/VerificationGateCard";
import { NarrativeSection } from "@/components/story/detail/NarrativeSection";
import { ClaimSection } from "@/components/story/detail/ClaimSection";
import { AnalysisSections } from "@/components/story/detail/AnalysisSections";
import { ArrowLeft, Share2 } from "lucide-react";
import Link from "next/link";

interface StoryPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateStaticParams() {
  const stories = getAllStories();
  return stories.map((s) => ({ slug: s.slug }));
}

export default async function StoryDetailPage({ params }: StoryPageProps) {
  const { slug } = await params;
  const story = getStoryBySlug(slug);

  if (!story) {
    notFound();
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">
      {/* Top Bar Navigation */}
      <div className="flex items-center justify-between py-2 border-b border-zinc-200/60 dark:border-zinc-800/60 text-xs">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Feed</span>
        </Link>
        <div className="flex items-center gap-3 text-zinc-400 font-mono text-[11px]">
          <span>VER.{story.version}.0</span>
          <span>•</span>
          <button
            aria-label="Share story"
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Headline & Metadata */}
      <header className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
            {story.topic}
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            {story.readingTimeMinutes} min synthesis
          </span>
        </div>

        <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 leading-tight">
          {story.headline}
        </h1>

        <p className="text-base text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
          {story.oneSentenceSummary}
        </p>

        {story.heroImageUrl && (
          <figure className="my-4 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={story.heroImageUrl}
              alt={story.headline}
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

      {/* Verification Gate Card */}
      <VerificationGateCard story={story} />

      {/* Narrative Synthesis */}
      <NarrativeSection story={story} />

      {/* Discrete Claim Audits */}
      <ClaimSection claims={story.claims} />

      {/* Multi-source comparison, Timeline, and Sources */}
      <AnalysisSections
        whereSourcesDiffer={story.whereSourcesDiffer}
        timeline={story.timeline}
        sources={story.sources}
      />
    </div>
  );
}
