import React from "react";
import { Compass } from "lucide-react";
import { StoryCard } from "@/components/story/StoryCard";
import { TopicFollowButton } from "@/components/story/TopicFollowButton";
import { getPublishedStories } from "@/lib/stories/dal";
import { getFollowedTopics, getReaderId } from "@/lib/reader";
import type { StoryTopic } from "@/types/story";

export const dynamic = "force-dynamic";

const TOPICS: StoryTopic[] = [
  "UK",
  "World",
  "Technology",
  "Science",
  "Business",
  "Climate",
  "Sport",
  "Culture",
  "Health",
  "Education",
];

export default async function ForYouPage() {
  const readerId = await getReaderId();
  const [followed, stories] = await Promise.all([
    getFollowedTopics(readerId),
    getPublishedStories({ limit: 30 }),
  ]);

  const prioritised = [
    ...stories.filter((story) => followed.includes(story.topic)),
    ...stories.filter((story) => !followed.includes(story.topic)),
  ];
  const lead = prioritised[0];
  const rest = prioritised.slice(1);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-3 border-b border-zinc-200/80 dark:border-zinc-800 pb-3">
        <h1 className="font-editorial text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
          <Compass className="w-5 h-5" />
          <span>For you</span>
        </h1>
        <p className="text-xs text-zinc-500">
          Topics you follow are ordered first. Nothing is filtered out — every
          published story stays reachable.
        </p>

        <div className="flex flex-wrap gap-2 pt-1">
          {TOPICS.map((topic) => (
            <TopicFollowButton
              key={topic}
              topic={topic}
              followed={followed.includes(topic)}
            />
          ))}
        </div>
        {!readerId && (
          <p className="text-[11px] text-zinc-400">
            Following a topic stores a preference on this device only.
          </p>
        )}
      </header>

      {lead && <StoryCard story={lead} variant="hero" />}

      <div className="space-y-6">
        {rest.map((story) => (
          <StoryCard key={story.id} story={story} />
        ))}
      </div>

      {prioritised.length === 0 && (
        <p className="text-xs text-zinc-500 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-6 text-center">
          Nothing published yet — follow a topic and stories will appear here
          once they clear the evidence gate.
        </p>
      )}
    </div>
  );
}
