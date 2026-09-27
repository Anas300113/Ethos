import { Story } from "@/types/story";
import storiesJson from "./mockStories.json";

export const MOCK_STORIES: Story[] = storiesJson as Story[];

export function getStoryBySlug(slug: string): Story | undefined {
  return MOCK_STORIES.find((s) => s.slug === slug);
}

export function getAllStories(): Story[] {
  return MOCK_STORIES;
}

export function getStoriesByTopic(topic: string): Story[] {
  if (!topic || topic.toLowerCase() === "all") return MOCK_STORIES;
  return MOCK_STORIES.filter((s) => s.topic.toLowerCase() === topic.toLowerCase());
}

export function searchStories(query: string): Story[] {
  const q = query.toLowerCase().trim();
  if (!q) return MOCK_STORIES;
  return MOCK_STORIES.filter(
    (s) =>
      s.headline.toLowerCase().includes(q) ||
      s.oneSentenceSummary.toLowerCase().includes(q) ||
      s.topic.toLowerCase().includes(q) ||
      s.whatHappened.toLowerCase().includes(q) ||
      s.claims.some((c) => c.statement.toLowerCase().includes(q))
  );
}
