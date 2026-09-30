import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildUpdateHistory } from "./history";
import type { Claim, ClaimStatus, Story } from "@/types/story";

const NOW = new Date("2026-09-30T12:00:00.000Z");

function claim(statement: string, status: ClaimStatus, extra?: Partial<Claim>): Claim {
  return {
    id: `id-${statement.slice(0, 12)}`,
    statement,
    status,
    confidenceScore: 0.8,
    explanation: "Assessed against the fetched document and independent reporting.",
    primaryEvidence: [],
    corroboratingSources: [],
    lastVerified: NOW.toISOString(),
    ...extra,
  };
}

function story(claims: Claim[], sources: { url: string; name: string }[] = []): Story {
  return {
    id: "story-1",
    slug: "test-story",
    headline: "Test story",
    oneSentenceSummary: "A story used to test update history.",
    topic: "UK",
    readingTimeMinutes: 1,
    lastUpdated: NOW.toISOString(),
    version: 2,
    whatHappened: "happened",
    whyItMatters: "matters",
    whatWeKnow: [],
    whatIsUnclear: [],
    sourcesAgreeOn: [],
    whereSourcesDiffer: [],
    claims,
    timeline: [],
    primaryEvidence: [],
    sources: sources.map((s, i) => ({
      id: `src-${i}`,
      url: s.url,
      title: "Source title",
      publishedAt: NOW.toISOString(),
      retrievedAt: NOW.toISOString(),
      publisher: { id: `p-${i}`, name: s.name, domain: `${s.name}.example`, tier: "SECONDARY_TIER2" },
    })),
    updates: [],
  };
}

describe("story update history", () => {
  it("records publication once, with the triggering source", () => {
    const drafts = buildUpdateHistory({
      created: true,
      now: NOW,
      story: story([], [{ url: "https://a.example/1", name: "Outlet A" }]),
      previousClaims: [],
      previousSources: [],
      writtenClaims: [],
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, "PUBLISHED");
    assert.equal(drafts[0].sourceLabel, "Outlet A");
    assert.equal(drafts[0].evidenceUrl, "https://a.example/1");
    assert.equal(drafts[0].timestamp, NOW);
  });

  it("records new reporting as CONTENT_UPDATE naming the new source", () => {
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      updateSummary: "Added 1 new source (Outlet B).",
      story: story([], [
        { url: "https://a.example/1", name: "Outlet A" },
        { url: "https://b.example/2", name: "Outlet B" },
      ]),
      previousClaims: [],
      previousSources: [{ url: "https://a.example/1", publisher: { name: "Outlet A" } }],
      writtenClaims: [],
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, "CONTENT_UPDATE");
    assert.equal(drafts[0].sourceLabel, "Outlet B");
    assert.equal(drafts[0].evidenceUrl, "https://b.example/2");
    assert.equal(drafts[0].previousState, null);
  });

  it("records an established claim weakening as CORRECTION with old/new state", () => {
    const statement = "The government will build 100,000 homes.";
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      story: story([
        claim(statement, "DISPUTED", {
          disputingSources: [
            {
              publisherName: "Ministry",
              url: "https://gov.example/denial",
              quote: "The figure is rejected.",
              disputeReason: "The issuing body denies the figure.",
            },
          ],
        }),
      ]),
      previousClaims: [{ statement, status: "SUPPORTED" }],
      previousSources: [],
      writtenClaims: [{ id: "new-id", statement, status: "DISPUTED" }],
    });
    const correction = drafts.find((d) => d.kind === "CORRECTION");
    assert.ok(correction, "a weakening of an established claim must be a CORRECTION");
    assert.equal(correction.previousState, "SUPPORTED");
    assert.equal(correction.newState, "DISPUTED");
    assert.ok(correction.reason && correction.reason.length > 0);
    assert.equal(correction.claimStatement, statement);
    assert.equal(correction.claimId, "new-id");
    // The evidence behind the change is recorded, not just described.
    assert.equal(correction.sourceLabel, "Ministry");
    assert.equal(correction.evidenceUrl, "https://gov.example/denial");
    assert.equal(correction.timestamp, NOW);
  });

  it("records status upgrades as CLAIM_REASSESSED, not corrections", () => {
    const statement = "Housing starts rose 4 percent.";
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      story: story([claim(statement, "PARTIALLY_SUPPORTED")]),
      previousClaims: [{ statement, status: "UNVERIFIED" }],
      previousSources: [],
      writtenClaims: [{ id: "c1", statement, status: "PARTIALLY_SUPPORTED" }],
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, "CLAIM_REASSESSED");
    assert.equal(drafts[0].previousState, "UNVERIFIED");
    assert.equal(drafts[0].newState, "PARTIALLY_SUPPORTED");
  });

  it("records a dropped established claim, ignores dropped unverified ones", () => {
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      story: story([]),
      previousClaims: [
        { statement: "Once established fact.", status: "CORROBORATED" },
        { statement: "Merely reported rumour.", status: "UNVERIFIED" },
      ],
      previousSources: [],
      writtenClaims: [],
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, "CORRECTION");
    assert.equal(drafts[0].previousState, "CORROBORATED");
    assert.equal(drafts[0].newState, null);
    assert.ok(drafts[0].claimStatement?.includes("Once established fact."));
  });

  it("writes nothing when a re-run changes no claim status", () => {
    const statement = "Unchanged claim.";
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      story: story([claim(statement, "SUPPORTED")]),
      previousClaims: [{ statement, status: "SUPPORTED" }],
      previousSources: [],
      writtenClaims: [{ id: "c1", statement, status: "SUPPORTED" }],
    });
    assert.deepEqual(drafts, []);
  });

  it("matches claims across whitespace and casing changes", () => {
    const drafts = buildUpdateHistory({
      created: false,
      now: NOW,
      story: story([claim("The  Minister  said  the  fund  opens.", "SUPPORTED")]),
      previousClaims: [{ statement: "the minister said the fund opens.", status: "UNVERIFIED" }],
      previousSources: [],
      writtenClaims: [
        { id: "c1", statement: "The  Minister  said  the  fund  opens.", status: "SUPPORTED" },
      ],
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].kind, "CLAIM_REASSESSED");
  });
});
