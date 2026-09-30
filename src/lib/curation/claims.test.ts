import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractClaims, isHedgedClaim } from "./claims";

describe("claim extraction", () => {
  it("splits the spec example into two atomic claims", () => {
    const claims = extractClaims(
      "The government announced a £4bn housing programme today, saying it expects the policy to create 100,000 homes."
    );
    assert.equal(claims.length, 2);
    assert.equal(claims[0].claimType, "QUOTE");
    assert.equal(claims[0].claimant, "The government");
    assert.equal(claims[0].isAttributionOnly, false);
    assert.equal(claims[1].claimType, "PREDICTION");
    assert.equal(claims[1].isAttributionOnly, true);
  });

  it("types numbers, dates, policy and statistics", () => {
    const [number] = extractClaims("The package is worth £4bn in total.");
    assert.equal(number.claimType, "NUMBER");
    const [date] = extractClaims("The vote takes place in March.");
    assert.equal(date.claimType, "DATE");
    const [policy] = extractClaims("Ministers launched a new housing scheme.");
    assert.equal(policy.claimType, "POLICY");
    const [statistic] = extractClaims(
      "Inflation rose to 4.2 percent in January, the survey found."
    );
    assert.equal(statistic.claimType, "STATISTIC");
  });

  it("flags opinions as attribution-only, never as fact", () => {
    const [opinion] = extractClaims(
      "Critics said the policy was a disgraceful failure."
    );
    assert.equal(opinion.claimType, "OTHER");
    assert.equal(opinion.isAttributionOnly, true);
  });

  it("keeps 'the minister said X' attributed, never bare X", () => {
    const [claim] = extractClaims(
      "The minister said the fund will open in spring."
    );
    assert.equal(claim.claimType, "QUOTE");
    assert.ok(claim.claimant?.toLowerCase().includes("minister"));
  });

  it("marks hedged quotes attribution-only, so no document can bank the figure", () => {
    // "The minister said the policy could cost £4bn" is quotable, but the
    // £4bn is ventured, not stated — a supporting document must not be
    // allowed to SUPPORT it as a bare fact.
    const [hedged] = extractClaims(
      "The minister said the policy could cost £4bn in total."
    );
    assert.equal(hedged.claimType, "QUOTE");
    assert.equal(hedged.isAttributionOnly, true);
    assert.ok(isHedgedClaim(hedged.statement));

    // Unhedged quotes keep their old behaviour.
    const [bare] = extractClaims(
      "The minister said the fund will open in spring."
    );
    assert.equal(bare.isAttributionOnly, false);
    assert.ok(!isHedgedClaim(bare.statement));

    const [estimate] = extractClaims(
      "The report estimated the scheme would save £2bn a year."
    );
    assert.equal(estimate.isAttributionOnly, true);
  });

  it("is deterministic and drops fragments", () => {
    const text = "Housing package announced. Yes. The council approved the scheme.";
    const first = extractClaims(text);
    const second = extractClaims(text);
    assert.deepEqual(first, second);
    assert.ok(first.every((c) => c.statement.split(/\s+/).length >= 4));
  });
});
