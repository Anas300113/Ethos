import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_FAIR_USE_CHARS,
  validateClaim,
  validateStory,
} from "@/lib/verification";
import type { Claim, Story } from "@/types/story";
import { getAllStories } from "@/data/mockStories";

function baseClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: "claim-test",
    statement: "Test statement.",
    status: "SUPPORTED",
    confidenceScore: 0.9,
    explanation: "Test explanation.",
    primaryEvidence: [
      {
        id: "ev-test",
        title: "Test evidence",
        url: "https://example.gov/doc",
        documentType: "GOVERNMENT_DOCUMENT",
        issuingBody: "Test Body",
        summary: "Summary.",
        date: "2026-09-27",
        excerpt: "Short excerpt.",
      },
    ],
    corroboratingSources: [
      {
        publisherName: "Reuters",
        url: "https://reuters.com/x",
        quote: "Short quote.",
      },
    ],
    lastVerified: "2026-09-27T10:30:00Z",
    ...overrides,
  };
}

describe("validateClaim", () => {
  it("accepts a fully grounded SUPPORTED claim", () => {
    assert.deepEqual(validateClaim(baseClaim()), []);
  });

  it("rejects SUPPORTED with no primary evidence", () => {
    const issues = validateClaim(baseClaim({ primaryEvidence: [] }));
    assert.ok(issues.some((i) => i.code === "SUPPORTED_MISSING_EVIDENCE"));
  });

  it("rejects SUPPORTED with no corroboration", () => {
    const issues = validateClaim(baseClaim({ corroboratingSources: [] }));
    assert.ok(issues.some((i) => i.code === "SUPPORTED_MISSING_CORROBORATION"));
  });

  it("rejects PARTIALLY_SUPPORTED with neither evidence nor corroboration", () => {
    const issues = validateClaim(
      baseClaim({ status: "PARTIALLY_SUPPORTED", primaryEvidence: [], corroboratingSources: [] })
    );
    assert.ok(issues.some((i) => i.code === "PARTIAL_MISSING_GROUNDING"));
  });

  it("rejects DISPUTED with no disputing source", () => {
    const issues = validateClaim(baseClaim({ status: "DISPUTED", disputingSources: [] }));
    assert.ok(issues.some((i) => i.code === "DISPUTED_MISSING_DISPUTE"));
  });

  it("rejects quotes over the fair-use cap", () => {
    const issues = validateClaim(
      baseClaim({ corroboratingSources: [{ publisherName: "X", url: "https://x.com", quote: "a".repeat(MAX_FAIR_USE_CHARS + 1) }] })
    );
    assert.ok(issues.some((i) => i.code === "QUOTE_TOO_LONG"));
  });

  it("rejects excerpts over the fair-use cap", () => {
    const issues = validateClaim(
      baseClaim({
        primaryEvidence: [
          {
            id: "ev",
            title: "T",
            documentType: "GOVERNMENT_DOCUMENT",
            issuingBody: "B",
            summary: "S",
            excerpt: "a".repeat(MAX_FAIR_USE_CHARS + 1),
          },
        ],
      })
    );
    assert.ok(issues.some((i) => i.code === "EXCERPT_TOO_LONG"));
  });

  it("rejects invalid URLs and out-of-range confidence", () => {
    const issues = validateClaim(
      baseClaim({
        confidenceScore: 1.5,
        corroboratingSources: [{ publisherName: "X", url: "not-a-url", quote: "ok" }],
      })
    );
    assert.ok(issues.some((i) => i.code === "CLAIM_BAD_CONFIDENCE"));
    assert.ok(issues.some((i) => i.code === "BAD_URL"));
  });
});

describe("validateStory", () => {
  it("flags empty stories and out-of-order timelines", () => {
    const base = getAllStories()[0] as Story;
    const broken: Story = {
      ...base,
      id: "broken",
      slug: "broken",
      claims: [],
      sources: [],
      timeline: [
        { id: "t2", timestamp: "2026-09-27T10:00:00Z", displayTime: "10:00", eventText: "B" },
        { id: "t1", timestamp: "2026-09-27T09:00:00Z", displayTime: "09:00", eventText: "A" },
      ],
    };
    const result = validateStory(broken);
    assert.equal(result.publishable, false);
    assert.ok(result.issues.some((i) => i.code === "STORY_NO_CLAIMS"));
    assert.ok(result.issues.some((i) => i.code === "STORY_NO_SOURCES"));
    assert.ok(result.issues.some((i) => i.code === "TIMELINE_OUT_OF_ORDER"));
  });

  it("seed dataset: every shipped story passes the publish gate", () => {
    const results = getAllStories().map((story) => validateStory(story));
    const failing = results.filter((r) => !r.publishable);
    for (const r of failing) {
      console.error(`[gate] ${r.slug} FAILED:`);
      for (const issue of r.issues) {
        console.error(`  - ${issue.code}: ${issue.message}`);
      }
    }
    assert.equal(
      failing.length,
      0,
      `Every seeded story must be publishable; ${failing.length} failed.`
    );
  });
});
