import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyRelationship,
  claimFigure,
  claimKeywords,
  sentenceWindows,
} from "./relationship";

const HOMES = "The government will build 100,000 homes.";
const COST = "The policy costs £4bn.";

describe("evidence relationship", () => {
  it("SUPPORTS when the document itself states the claim", () => {
    const verdict = classifyRelationship({
      statement: HOMES,
      documentText:
        "The government will build 100,000 homes by 2029, the housing secretary confirmed on Tuesday. Funding is allocated in the spending review.",
    });
    assert.equal(verdict.relationship, "SUPPORTS");
    assert.equal(verdict.figureMatched, true);
    assert.ok(verdict.passage && verdict.passage.length > 0);
  });

  it("CONTRADICTS when the document reports the figure to reject it", () => {
    const verdict = classifyRelationship({
      statement: HOMES,
      documentText:
        "The opposition claims the government will build 100,000 homes. The government has rejected the figure.",
    });
    assert.equal(verdict.relationship, "CONTRADICTS");
    assert.equal(verdict.denial, true);
  });

  it("CONTRADICTS an explicit denial even with full keyword overlap", () => {
    const verdict = classifyRelationship({
      statement: COST,
      documentText:
        "The policy costs £4bn, according to reports. This is misleading: the department said the true cost is £400m, not £4bn.",
    });
    assert.equal(verdict.relationship, "CONTRADICTS");
  });

  it("MENTIONS_ONLY when a third party is the asserter", () => {
    const verdict = classifyRelationship({
      statement: HOMES,
      documentText:
        "The opposition claims the government will build 100,000 homes, and says ministers have no plan to deliver them.",
    });
    assert.equal(verdict.relationship, "MENTIONS_ONLY");
    assert.ok(verdict.reason.toLowerCase().includes("third party"));
  });

  it("MENTIONS_ONLY when the document hedges a fact claim as a possibility", () => {
    const verdict = classifyRelationship({
      statement: COST,
      documentText:
        "The minister said the policy could cost £4bn if councils adopt the full scheme, though final figures are not yet agreed.",
    });
    assert.equal(verdict.relationship, "MENTIONS_ONLY");
    assert.notEqual(verdict.hedge, "none");
  });

  it("MENTIONS_ONLY for estimates presented against a bare-fact claim", () => {
    const verdict = classifyRelationship({
      statement: "The scheme created 100,000 homes.",
      documentText:
        "Around 100,000 homes may have been created under the scheme, analysts estimated, though the official count is not yet published.",
    });
    assert.equal(verdict.relationship, "MENTIONS_ONLY");
    assert.equal(verdict.hedge, "estimate");
  });

  it("CONTRADICTS when the figure is reported as disputed", () => {
    // "the count is disputed" is a genuine denial signal about the figure:
    // the document reports the number only to say it is contested, so it can
    // feed a DISPUTE, never a SUPPORT.
    const verdict = classifyRelationship({
      statement: "The scheme created 100,000 homes.",
      documentText:
        "Around 100,000 homes may have been created under the scheme, analysts estimated, though the count is disputed.",
    });
    assert.equal(verdict.relationship, "CONTRADICTS");
    assert.equal(verdict.denial, true);
  });

  it("SUPPORTS an attributed claim when the document carries the same hedge", () => {
    const verdict = classifyRelationship({
      statement: "The minister said the policy could cost £4bn.",
      claimType: "QUOTE",
      isAttributionOnly: true,
      documentText:
        "The minister said the policy could cost £4bn if councils adopt the full scheme, a spokesperson confirmed.",
    });
    assert.equal(verdict.relationship, "SUPPORTS");
  });

  it("IRRELEVANT when the document is about something else", () => {
    const verdict = classifyRelationship({
      statement: HOMES,
      documentText: "Housing starts fell again in March, the ONS said.",
    });
    assert.equal(verdict.relationship, "IRRELEVANT");
  });

  it("UNCLEAR on documents too thin to judge", () => {
    const verdict = classifyRelationship({
      statement: HOMES,
      documentText: "Homes.",
    });
    assert.equal(verdict.relationship, "UNCLEAR");
    assert.equal(verdict.passage, null);
  });

  it("rejects a SUPPORTS claim when the figure is absent", () => {
    const verdict = classifyRelationship({
      statement: COST,
      documentText:
        "The government today announced a major new housing policy with cross-party support and funding over several years.",
    });
    assert.ok(
      verdict.relationship === "MENTIONS_ONLY" ||
        verdict.relationship === "IRRELEVANT" ||
        verdict.relationship === "UNCLEAR"
    );
    assert.equal(verdict.figureMatched, false);
  });

  it("exposes tokenisers for the audit trail", () => {
    // Three-letter tokens (100, 000) are dropped by the length filter; the
    // numeric substance travels through claimFigure instead.
    assert.deepEqual(claimKeywords("The government will build 100,000 homes."), [
      "government",
      "will",
      "build",
      "homes",
    ]);
    assert.equal(claimFigure(COST), "£4bn");
    assert.equal(claimFigure("No figures here at all."), null);
    const windows = sentenceWindows("First sentence here. Second sentence there. Short.");
    assert.ok(windows.length >= 2);
    assert.ok(windows[0].toLowerCase().includes("first sentence"));
  });
});
