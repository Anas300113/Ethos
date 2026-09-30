/**
 * Dossier visibility tests.
 *
 * The pipeline stores honest metadata — sourcing groups, assessed
 * relationships, judgement methods, extraction provenance, correction history.
 * Metadata nobody renders is metadata that rots, so these tests render the
 * real reader components and assert the facts actually reach the page (and,
 * just as importantly, that absent metadata is NOT invented).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ClaimSection } from "./ClaimSection";
import { AnalysisSections } from "./AnalysisSections";
import { CorrectionsSection } from "./CorrectionsSection";
import { sourcingHeadline, summariseSourcing } from "@/lib/sourcing-summary";
import type { ArticleSource, Claim, StoryUpdate } from "@/types/story";

const source = (
  id: string,
  name: string,
  domain: string,
  sourcingGroup: string,
  sharedSourceLabel: string
): ArticleSource => ({
  id,
  publisher: { id: `pub-${id}`, name, domain, tier: "SECONDARY_TIER1" },
  url: `https://${domain}/article-${id}`,
  title: `Reporting from ${name}`,
  publishedAt: "2026-09-20T09:00:00.000Z",
  retrievedAt: "2026-09-20T09:05:00.000Z",
  sourcingGroup,
  sharedSourceLabel,
});

// Two outlets printing one Reuters dispatch, one outlet filing its own.
const sources: ArticleSource[] = [
  source("s1", "The Guardian", "theguardian.com", "wire:Reuters", "Reuters"),
  source("s2", "The i", "thei.com", "wire:Reuters", "Reuters"),
  source(
    "s3",
    "Associated Press",
    "apnews.com",
    "independent:apnews.com",
    "independent"
  ),
];

const claim: Claim = {
  id: "clm_1",
  statement: "The bill passed by eight votes.",
  status: "SUPPORTED",
  confidenceScore: 0.9,
  explanation: "Division lists were checked.",
  claimType: "number",
  claimant: "the Commons register",
  extractionProvenance: "remote:gemini-test",
  independentSourceCount: 1,
  sourcingNote: "3 outlets repeat a single Reuters report",
  lastVerified: "2026-09-20T10:00:00.000Z",
  corroboratingSources: [
    {
      publisherName: "The Guardian",
      url: "https://theguardian.com/article-s1",
      quote: "passed by eight votes",
    },
    {
      publisherName: "The i",
      url: "https://thei.com/article-s2",
      quote: "passed by eight votes",
    },
  ],
  primaryEvidence: [
    {
      id: "doc_1",
      title: "Division 1234 results",
      url: "https://parliament.example/division-1234",
      documentType: "PARLIAMENTARY_RECORD",
      issuingBody: "House of Commons",
      summary: "Recorded vote totals.",
      date: "2026-09-20",
      excerpt: "Ayes 301, Noes 293.",
      relationship: "CONTRADICTS",
      relationshipReason: "The recorded majority is seven, not eight.",
      supportingPassage: "Noes 293 to Ayes 301",
      assessmentMethod: "AI_HYBRID",
      assessmentModel: "gemini-test",
    },
  ],
};

const claimWithoutMetadata: Claim = {
  id: "clm_2",
  statement: "A vote took place.",
  status: "UNVERIFIED",
  confidenceScore: 0.4,
  explanation: "Only one outlet reported it.",
  lastVerified: "2026-09-20T10:00:00.000Z",
  primaryEvidence: [],
  corroboratingSources: [],
};

const updates: StoryUpdate[] = [
  {
    id: "upd_2",
    timestamp: "2026-09-21T08:00:00.000Z",
    kind: "CORRECTION",
    whatChanged: "Margin corrected from eight to seven votes.",
    reason: "The division paper lists a majority of seven.",
    claimStatement: "The bill passed by eight votes.",
    previousState: "SUPPORTED",
    newState: "PARTIALLY_SUPPORTED",
    sourceLabel: "House of Commons",
    evidenceUrl: "https://parliament.example/division-1234",
  },
  {
    id: "upd_1",
    timestamp: "2026-09-20T10:00:00.000Z",
    kind: "PUBLISHED",
    whatChanged: "Story published with 3 sources.",
  },
];

test("claim card shows independence, provenance and the assessed relationship", () => {
  const html = renderToStaticMarkup(
    createElement(ClaimSection, { claims: [claim] })
  );

  // Independence is the count that matters, with the outlet count beside it.
  assert.match(html, /1 independent origin behind this claim/);
  assert.match(html, /2 outlets quoted/);
  assert.match(html, /3 outlets repeat a single Reuters report/);

  // How the claim sentence was obtained, and how the document was judged.
  assert.match(html, /extracted by gemini-test/);
  assert.match(html, /verdict assisted by gemini-test/);
  // The label is lower-case text styled with the `uppercase` utility class.
  assert.match(html, /font-semibold uppercase tracking-wider text-rose-700[^>]*>contradicts/);
  assert.match(html, /The recorded majority is seven, not eight/);
  assert.match(html, /Passage relied on/);
});

test("claim card stays silent instead of inventing metadata it does not have", () => {
  const html = renderToStaticMarkup(
    createElement(ClaimSection, { claims: [claimWithoutMetadata] })
  );
  assert.doesNotMatch(html, /independent origin/);
  assert.doesNotMatch(html, /extracted by/);
  assert.doesNotMatch(html, /verdict/);
});

test("source index reports outlets and independent origins separately", () => {
  const html = renderToStaticMarkup(
    createElement(AnalysisSections, {
      whereSourcesDiffer: [],
      timeline: [],
      sources,
    })
  );
  assert.match(html, /3 outlets · 2 origins/);
  assert.match(html, /2 via Reuters/);
});

test("corrections section renders the history the pipeline appended", () => {
  const html = renderToStaticMarkup(
    createElement(CorrectionsSection, { updates })
  );
  assert.match(html, /1 correction/);
  assert.match(html, /Margin corrected from eight to seven votes/);
  assert.match(html, /The division paper lists a majority of seven/);
  assert.match(html, /SUPPORTED/);
  assert.match(html, /PARTIALLY_SUPPORTED/);
  assert.match(html, /Changed by House of Commons/);
});

test("an uncorrected story says so rather than showing a blank section", () => {
  const html = renderToStaticMarkup(
    createElement(CorrectionsSection, { updates: [] })
  );
  assert.match(html, /Nothing has been corrected/);
});

test("sourcing summary counts origins, not outlets", () => {
  const summary = summariseSourcing(sources);
  assert.equal(summary.outlets, 3);
  assert.equal(summary.origins, 2);
  assert.deepEqual(
    summary.shared.map((entry) => entry.label),
    ["Reuters"]
  );
  assert.equal(sourcingHeadline(summary), "3 outlets · 2 independent origins");

  // Rows that predate the column fall back to their own domain, i.e. each one
  // is its own origin — the summary never claims independence it cannot see.
  // Rows that predate the column fall back to their own domain, i.e. each one
  // is its own origin — the summary never claims independence it cannot see.
  const legacy: ArticleSource[] = sources.map((item) => ({
    id: item.id,
    publisher: item.publisher,
    url: item.url,
    title: item.title,
    publishedAt: item.publishedAt,
    retrievedAt: item.retrievedAt,
  }));
  const legacySummary = summariseSourcing(legacy);
  assert.equal(legacySummary.grouped, false);
  // No grouping pass has run over these rows, so independence is not ours to
  // claim: the headline says "outlets" and stops there.
  assert.equal(sourcingHeadline(legacySummary), "3 outlets");

  const ungroupedHtml = renderToStaticMarkup(
    createElement(AnalysisSections, {
      whereSourcesDiffer: [],
      timeline: [],
      sources: legacy,
    })
  );
  assert.match(ungroupedHtml, /3 outlets/);
  assert.doesNotMatch(ungroupedHtml, /independent/);
});

test("extraction provenance is labelled with the ruleset, not dressed up", () => {
  const labelled = (extractionProvenance: string) =>
    renderToStaticMarkup(
      createElement(ClaimSection, {
        claims: [{ ...claimWithoutMetadata, extractionProvenance }],
      })
    );

  // These are the shapes the ingest path and the seed actually write.
  assert.match(labelled("seed"), /editorially curated/);
  assert.match(labelled("local-deterministic@mvp-1"), /extracted locally \(rules mvp-1\)/);
  assert.match(
    labelled("local-deterministic:fallback@mvp-1"),
    /extracted locally after a model call failed \(rules mvp-1\)/
  );
  assert.match(labelled("remote:gemini-2.5-flash"), /extracted by gemini-2\.5-flash/);
});


