import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NOT_ASSESSED,
  assessmentMethodLabel,
  claimLabel,
  claimMeaning,
  claimTone,
  extractionLabel,
  greeting,
  relationshipLabel,
  updatedLabel,
} from "./claim.ts";

describe("claim status language", () => {
  it("never renders a percentage or a score", () => {
    for (const text of [
      claimLabel("SUPPORTED"),
      claimLabel("UNVERIFIED"),
      claimMeaning("SUPPORTED"),
      claimMeaning(null),
    ]) {
      assert.ok(!/\d+\s*%/.test(text), `status copy leaked a percentage: ${text}`);
    }
  });

  it("treats missing status as its own answer", () => {
    assert.equal(claimLabel(null), NOT_ASSESSED);
    assert.equal(claimTone(null), "unknown");
    assert.ok(claimMeaning(null).length > 0);
  });

  it("keeps each tone distinct so colour is not the only signal", () => {
    assert.equal(claimTone("SUPPORTED"), "grounded");
    assert.equal(claimTone("PARTIALLY_SUPPORTED"), "qualified");
    assert.equal(claimTone("DISPUTED"), "contested");
    assert.equal(claimTone("OUTDATED"), "stale");
    assert.equal(claimTone("UNVERIFIED"), "unknown");
  });
});

describe("evidence relationship labels", () => {
  it("maps every stored relationship to reader copy", () => {
    assert.equal(relationshipLabel("SUPPORTS"), "Supports this claim");
    assert.equal(relationshipLabel("CONTRADICTS"), "Contradicts this claim");
    assert.equal(relationshipLabel("MENTIONS_ONLY"), "Mentions the topic, does not test the claim");
  });

  it("returns null when no assessment is stored, never a silent neutral", () => {
    assert.equal(relationshipLabel(null), null);
    assert.equal(relationshipLabel(undefined), null);
    assert.equal(relationshipLabel("SOMETHING_NEW"), null);
  });
});

describe("provenance and method honesty", () => {
  it("names the model only for remote extraction", () => {
    assert.match(extractionLabel("remote:gpt-5"), /model-assisted/);
    assert.match(extractionLabel("local-deterministic"), /rule-based/);
    assert.equal(extractionLabel("seed"), "Editorially curated example");
    assert.equal(extractionLabel(null), "Editorially curated example");
  });

  it("never claims AI checked alone", () => {
    assert.match(assessmentMethodLabel("DETERMINISTIC"), /ETHOS rules/);
    assert.match(assessmentMethodLabel("AI_HYBRID"), /AI reading/);
    assert.match(assessmentMethodLabel(null), /not recorded/);
  });
});

describe("time and greeting copy", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");

  it("uses plain steps below a week and a date beyond it", () => {
    assert.equal(updatedLabel("2026-10-03T11:59:50Z", now), "just now");
    assert.equal(updatedLabel("2026-10-03T11:30:00Z", now), "30 min ago");
    assert.equal(updatedLabel("2026-10-03T09:00:00Z", now), "3 hours ago");
    assert.equal(updatedLabel("2026-10-01T12:00:00Z", now), "2 days ago");
    assert.equal(updatedLabel("2026-08-03T12:00:00Z", now).length > 0, true);
  });

  it("says no date rather than inventing one", () => {
    assert.equal(updatedLabel(null, now), "no date");
    assert.equal(updatedLabel("not-a-date", now), "no date");
  });

  it("greets by hour of day", () => {
    assert.equal(greeting(new Date("2026-10-03T09:00:00")), "Good morning.");
    assert.equal(greeting(new Date("2026-10-03T15:00:00")), "Good afternoon.");
    assert.equal(greeting(new Date("2026-10-03T21:00:00")), "Good evening.");
  });
});
