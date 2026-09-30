import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  groupSources,
  independentGroupCount,
  sourcingNote,
  textSimilarity,
} from "./independence";

const GOV_LINE =
  "The government will build 100,000 homes by 2029, the housing secretary confirmed.";

describe("source independence", () => {
  it("counts a shared wire as ONE source, not three confirmations", () => {
    // BBC + Reuters article quoting the government statement + Guardian
    // article quoting Reuters: one sourcing chain, not three confirmations.
    const grouped = groupSources([
      {
        id: "a1",
        publisherName: "BBC News",
        publisherDomain: "bbc.co.uk",
        title: "Government pledges 100,000 homes",
        excerpt: `${GOV_LINE} Reporting by Reuters.`,
      },
      {
        id: "a2",
        publisherName: "Reuters",
        publisherDomain: "reuters.com",
        title: "UK government pledges 100,000 homes",
        excerpt: `${GOV_LINE} (Reuters)`,
      },
      {
        id: "a3",
        publisherName: "The Guardian",
        publisherDomain: "theguardian.com",
        title: "Ministers pledge 100,000 homes",
        excerpt: `${GOV_LINE} According to Reuters, ministers said.`,
      },
    ]);
    assert.equal(independentGroupCount(grouped), 1);
    const note = sourcingNote(grouped);
    assert.ok(note);
    assert.ok(note.includes("1 independent source"));
    assert.ok(note.includes("Reuters"));
  });

  it("keeps genuinely independent reporting independent", () => {
    const grouped = groupSources([
      {
        id: "b1",
        publisherName: "BBC News",
        publisherDomain: "bbc.co.uk",
        title: "Council approves northern housing scheme",
        excerpt: "Leeds council approved 2,000 homes after a three-hour planning meeting.",
      },
      {
        id: "b2",
        publisherName: "The Guardian",
        publisherDomain: "theguardian.com",
        title: "ONS reports housing starts up",
        excerpt: "Official statistics show housing starts rose 4 percent last quarter.",
      },
    ]);
    assert.equal(independentGroupCount(grouped), 2);
    assert.equal(sourcingNote(grouped), null);
  });

  it("detects uncredited syndication from near-identical copy", () => {
    const copy =
      "The housing secretary confirmed the 100,000 homes target at a press conference in Manchester on Tuesday morning.";
    const grouped = groupSources([
      {
        id: "c1",
        publisherName: "Outlet One",
        publisherDomain: "one.example",
        title: "Housing target confirmed",
        excerpt: copy,
      },
      {
        id: "c2",
        publisherName: "Outlet Two",
        publisherDomain: "two.example",
        title: "Housing target confirmed today",
        excerpt: copy,
      },
    ]);
    assert.equal(independentGroupCount(grouped), 1);
    assert.ok(grouped.every((item) => item.sourcingGroup.startsWith("syndicated:")));
    const note = sourcingNote(grouped);
    assert.ok(note && note.includes("shared wire copy"));
  });

  it("does not merge stories on a shared organisation alone", () => {
    // Same government, different events, different prose: independent.
    const grouped = groupSources([
      {
        id: "d1",
        publisherName: "BBC News",
        publisherDomain: "bbc.co.uk",
        title: "Government funds northern rail link",
        excerpt: "Ministers committed £2bn to the trans-Pennine rail upgrade on Friday.",
      },
      {
        id: "d2",
        publisherName: "BBC News",
        publisherDomain: "bbc.co.uk",
        title: "Government sets out school funding",
        excerpt: "The education secretary announced £500m for school repairs in spring.",
      },
    ]);
    assert.equal(textSimilarity("rail upgrade funding north", "school repairs funding spring") < 0.55, true);
    assert.equal(independentGroupCount(grouped), 1);
  });
});
