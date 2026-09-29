import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessClaim, documentSupportsClaim } from "./assess";

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
