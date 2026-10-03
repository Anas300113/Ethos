import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ALL_TOPICS,
  isStoryTopic,
  toMobileCard,
  type MobileStoryCard,
} from "@/lib/mobile/dto";
import type { StoryCardData } from "@/lib/mobile/dto";

function cardData(): StoryCardData {
  return {
    slug: "test-story",
    headline: "Test headline",
    oneSentenceSummary: "Test summary",
    topic: "UK",
    readingTimeMinutes: 4,
    lastUpdated: new Date("2026-01-02T00:00:00Z").toISOString(),
    version: 2,
    isDeveloping: false,
    heroImageUrl: "https://example.com/hero.jpg",
    heroImageCaption: "A caption",
    sources: [
      {
        id: "a",
        url: "https://a.example/article",
        title: "A",
        publishedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
        retrievedAt: new Date("2026-01-02T00:00:00Z").toISOString(),
        publisher: {
          id: "pa",
          name: "Paper A",
          domain: "a.example",
          tier: "SECONDARY_TIER1",
        },
      },
    ],
    claimStatuses: ["SUPPORTED", "DISPUTED"],
    correctionCount: 1,
  };
}

describe("mobile contract", () => {
  it("emits every field the phone renders", () => {
    const card: MobileStoryCard = toMobileCard(cardData());
    for (const field of [
      "slug",
      "headline",
      "oneSentenceSummary",
      "topic",
      "readingTimeMinutes",
      "lastUpdated",
      "version",
      "isDeveloping",
      "heroImageUrl",
      "heroImageCaption",
      "sources",
      "sourcing",
      "leadClaimStatus",
      "statusSummary",
      "correctionCount",
    ] as const) {
      assert.ok(field in card, `missing mobile card field: ${field}`);
    }
    assert.equal(card.leadClaimStatus, "SUPPORTED");
    assert.deepEqual(card.statusSummary, [
      { status: "SUPPORTED", count: 1 },
      { status: "DISPUTED", count: 1 },
    ]);
    assert.equal(card.sourcing.outlets, 1);
  });

  it("keeps one topic vocabulary on both sides of the API", () => {
    assert.deepEqual(ALL_TOPICS, [
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
    ]);
    assert.equal(isStoryTopic("UK"), true);
    assert.equal(isStoryTopic("Politics"), false);
    assert.equal(isStoryTopic(undefined), false);
  });
});
