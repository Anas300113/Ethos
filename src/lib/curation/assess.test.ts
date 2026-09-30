import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  assessClaim,
  documentSupportsClaim,
  reconcileAiRelationship,
  deterministicVerdict,
} from "./assess";

const BASE = {
  statement: "The government announced a £4bn housing programme.",
  claimType: "POLICY",
  claimant: "The government",
  isAttributionOnly: false,
  reportingOutlets: ["BBC News", "The Guardian"],
  corroboratingQuotes: [
    { publisherName: "BBC News", url: "https://www.bbc.co.uk/news/1", quote: "The government announced a £4bn housing programme." },
    { publisherName: "The Guardian", url: "https://www.theguardian.com/politics/2", quote: "Ministers set out a £4bn package for housebuilding." },
  ],
  disputingQuotes: [],
};

describe("evidence assessment", () => {
  it("passes only when the document supports the SPECIFIC claim", () => {
    const supporting =
      "HM Treasury today confirmed a £4bn housing programme for England, with funding for 100,000 homes over three years.";
    const topicalButNotSupporting =
      "The government publishes its housing strategy on Thursday amid rising homelessness across England.";
    assert.ok(documentSupportsClaim(BASE.statement, supporting));
    assert.ok(!documentSupportsClaim(BASE.statement, topicalButNotSupporting));
  });

  it("requires the claim's figure to appear in the document", () => {
    const wrongFigure =
      "The government announced a housing programme for England today, funded at £400m per year.";
    assert.ok(!documentSupportsClaim(BASE.statement, wrongFigure));
  });

  it("SUPPORTED with document, CORROBORATED with document + multi-outlet", () => {
    const doc =
      "HM Treasury confirmed a £4bn housing programme for England today, with " +
      "funding allocated across three years to local authorities.";
    const single = assessClaim({
      ...BASE,
      reportingOutlets: ["BBC News"],
      corroboratingQuotes: BASE.corroboratingQuotes.slice(0, 1),
      primaryDocumentText: doc,
      primaryDocumentTitle: "£4bn housing programme announcement",
      primaryDocumentUrl: "https://www.gov.uk/government/press",
      primaryDocumentBody: "HM Treasury",
    });
    assert.equal(single.status, "SUPPORTED");
    assert.equal(single.documentGrounded, true);
    const multi = assessClaim({ ...BASE, primaryDocumentText: doc });
    assert.equal(multi.status, "CORROBORATED");
    assert.equal(multi.documentGrounded, true);
  });

  it("holds DISPUTED when the fetched document reports the claim to deny it", () => {
    // The adversarial case: keywords + figure all match, but the passage
    // exists to REJECT the figure. This must never become SUPPORTED.
    const doc =
      "The opposition claims the government will build 100,000 homes. " +
      "The government has rejected the figure.";
    const result = assessClaim({
      statement: "The government will build 100,000 homes.",
      claimType: "POLICY",
      claimant: null,
      isAttributionOnly: false,
      reportingOutlets: ["BBC News"],
      corroboratingQuotes: [
        { publisherName: "BBC News", url: "https://www.bbc.co.uk/news/1", quote: "The government will build 100,000 homes." },
      ],
      disputingQuotes: [],
      primaryDocumentText: doc,
      primaryDocumentTitle: "Opposition housing claims",
      primaryDocumentBody: "Parliamentary debate record",
    });
    assert.equal(result.status, "DISPUTED");
    assert.equal(result.documentGrounded, false);
    assert.equal(result.verdict.relationship, "CONTRADICTS");
    assert.equal(result.assessmentMethod, "DETERMINISTIC");
  });

  it("records MENTIONS_ONLY verdicts with reason and passage for the audit trail", () => {
    const doc =
      "The minister said the policy could cost £4bn if councils adopt the full scheme, though final figures are not yet agreed.";
    const verdict = deterministicVerdict(
      "The policy costs £4bn.",
      "NUMBER",
      false,
      doc
    );
    assert.equal(verdict.relationship, "MENTIONS_ONLY");
    assert.notEqual(verdict.hedge, "none");
    assert.ok(verdict.passage && verdict.passage.length > 0);
  });

  it("never lets an AI verdict upgrade past the deterministic veto", () => {
    const deterministic = deterministicVerdict(
      "The policy costs £4bn.",
      "NUMBER",
      false,
      "The minister said the policy could cost £4bn if councils adopt the full scheme."
    );
    assert.notEqual(deterministic.relationship, "SUPPORTS");

    // Model says SUPPORTS anyway: rejected, deterministic stands, no hybrid.
    const rejected = reconcileAiRelationship(
      deterministic,
      { relationship: "SUPPORTS", reason: "looks fine", supportingPassage: null, confidence: 0.99 },
      "gpt-4o-mini"
    );
    assert.equal(rejected.verdict.relationship, deterministic.relationship);
    assert.equal(rejected.method, "DETERMINISTIC");
    assert.equal(rejected.model, null);

    // Model confirms a genuine SUPPORTS: hybrid co-signature, model recorded.
    const genuine = deterministicVerdict(
      "The government announced a £4bn housing programme.",
      "POLICY",
      false,
      "HM Treasury today confirmed a £4bn housing programme for England, with funding for 100,000 homes over three years."
    );
    assert.equal(genuine.relationship, "SUPPORTS");
    const confirmed = reconcileAiRelationship(
      genuine,
      { relationship: "SUPPORTS", reason: "figure and substance stated", supportingPassage: "confirmed a £4bn housing programme", confidence: 0.9 },
      "gpt-4o-mini"
    );
    assert.equal(confirmed.verdict.relationship, "SUPPORTS");
    assert.equal(confirmed.method, "AI_HYBRID");
    assert.equal(confirmed.model, "gpt-4o-mini");

    // Model downgrades SUPPORTS: allowed, claim becomes more cautious.
    const downgraded = reconcileAiRelationship(
      genuine,
      { relationship: "MENTIONS_ONLY", reason: "only a passing mention", supportingPassage: null, confidence: 0.4 },
      "gpt-4o-mini"
    );
    assert.equal(downgraded.verdict.relationship, "MENTIONS_ONLY");
    assert.equal(downgraded.method, "AI_HYBRID");
  });

  it("counts a shared wire as one source: no CORROBORATED on repetition", () => {
    const doc =
      "HM Treasury confirmed a £4bn housing programme for England today, with " +
      "funding allocated across three years to local authorities.";
    // Three outlets but ONE sourcing group (the wire): SUPPORTED at best.
    const repeated = assessClaim({
      ...BASE,
      primaryDocumentText: doc,
      sourcingGroups: ["wire:reuters"],
      sourcingNote: "3 outlets, but 1 independent source (Reuters) — repetition, not confirmation.",
    });
    assert.equal(repeated.status, "SUPPORTED");
    assert.ok(repeated.explanation.includes("repeat a single source"));

    // Two genuinely independent groups: CORROBORATED.
    const independent = assessClaim({
      ...BASE,
      primaryDocumentText: doc,
      sourcingGroups: ["independent:bbc.co.uk", "independent:theguardian.com"],
    });
    assert.equal(independent.status, "CORROBORATED");
    assert.ok(independent.explanation.includes("2 independent sources"));
  });

  it("multi-outlet without a document is PARTIALLY_SUPPORTED, not CONFIRMED", () => {
    const result = assessClaim(BASE);
    assert.equal(result.status, "PARTIALLY_SUPPORTED");
    assert.equal(result.documentGrounded, false);
    assert.ok(result.explanation.includes("reported"));
  });

  it("single outlet without a document is UNVERIFIED", () => {
    const result = assessClaim({
      ...BASE,
      reportingOutlets: ["BBC News"],
      corroboratingQuotes: BASE.corroboratingQuotes.slice(0, 1),
    });
    assert.equal(result.status, "UNVERIFIED");
  });

  it("conflicting outlets are DISPUTED, both sides retained", () => {
    const result = assessClaim({
      ...BASE,
      disputingQuotes: [
        { publisherName: "Al Jazeera", url: "https://www.aljazeera.com/3", quote: "Officials deny the package was approved.", disputeReason: "Ministry denies the figure was agreed." },
      ],
    });
    assert.equal(result.status, "DISPUTED");
    assert.ok(result.explanation.includes("Al Jazeera"));
  });

  it("predictions and opinions are never established", () => {
    const prediction = assessClaim({
      ...BASE,
      statement: "The policy will create 100,000 homes.",
      claimType: "PREDICTION",
      isAttributionOnly: true,
      primaryDocumentText: "The government announced a £4bn housing programme for England and said it expects the policy to create 100,000 homes.",
    });
    assert.equal(prediction.status, "UNVERIFIED");
    assert.ok(prediction.explanation.includes("forecast"));

    const opinion = assessClaim({
      ...BASE,
      statement: "The policy was a disgraceful failure.",
      claimType: "OTHER",
      isAttributionOnly: true,
    });
    assert.equal(opinion.status, "UNVERIFIED");
    assert.ok(!opinion.explanation.includes("establisshable"));
  });
});
