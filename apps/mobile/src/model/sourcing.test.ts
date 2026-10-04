import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sharedOriginLine, sourcingBadge, sourceRoleLabel } from "./sourcing.ts";
import type { Sourcing } from "../api/types";

function sourcing(overrides: Partial<Sourcing>): Sourcing {
  return {
    outlets: 0,
    origins: 0,
    grouped: false,
    headline: "",
    note: null,
    shared: [],
    ...overrides,
  };
}

describe("sourcing badge honesty", () => {
  it("never says independent when the grouping pass has not run", () => {
    const badge = sourcingBadge(sourcing({ outlets: 4, origins: 4, grouped: false }));
    assert.ok(!/independent/i.test(badge.label), badge.label);
    assert.equal(badge.independenceMeasured, false);
    assert.ok(badge.caveat);
  });

  it("prefers the server-computed headline over any client math", () => {
    const badge = sourcingBadge(
      sourcing({ outlets: 5, origins: 2, grouped: true, headline: "5 outlets · 2 independent origins" })
    );
    assert.equal(badge.label, "5 outlets · 2 independent origins");
    assert.equal(badge.independenceMeasured, true);
    assert.equal(badge.caveat, null);
  });

  it("falls back to an outlet count only when ungrouped", () => {
    const badge = sourcingBadge(sourcing({ outlets: 3, grouped: false }));
    assert.equal(badge.label, "3 outlets");
    assert.ok(!/independent/i.test(badge.label));
  });

  it("says sources not listed instead of guessing", () => {
    const badge = sourcingBadge(undefined);
    assert.equal(badge.label, "sources not listed");
    assert.equal(badge.independenceMeasured, false);
    const empty = sourcingBadge(sourcing({ outlets: 0 }));
    assert.equal(empty.label, "sources not listed");
  });

  it("renders the server fallback with singular/plural agreement", () => {
    const one = sourcingBadge(sourcing({ outlets: 1, origins: 1, grouped: true }));
    assert.equal(one.label, "1 outlet · 1 independent origin");
  });
});

describe("shared origin copy", () => {
  it("names the wire and its outlets", () => {
    assert.equal(
      sharedOriginLine({ label: "Reuters", outlets: ["Paper A", "Paper B"] }),
      "2 outlets via Reuters: Paper A, Paper B"
    );
    assert.equal(sharedOriginLine({ label: "PA", outlets: ["Paper A"] }), "1 outlet via PA: Paper A");
  });
});

describe("source role labels", () => {
  it("reports ungrouped sources as ungrouped", () => {
    assert.equal(sourceRoleLabel({}, 1), "Sourcing origin not recorded");
  });

  it("distinguishes a wire dispatch from own reporting", () => {
    assert.equal(
      sourceRoleLabel({ sourcingGroup: "wire:reuters", sharedSourceLabel: "Reuters" }, 3),
      "Reporting carried from Reuters"
    );
    assert.equal(
      sourceRoleLabel({ sourcingGroup: "wire:reuters", sharedSourceLabel: "Reuters" }, 1),
      "Filed from Reuters"
    );
    assert.equal(sourceRoleLabel({ sourcingGroup: "independent:paper.example" }, 1), "This outlet's own reporting");
  });

  it("marks syndicated copies as copies", () => {
    assert.match(
      sourceRoleLabel({ sourcingGroup: "syndicated:guardian", sharedSourceLabel: "Guardian" }, 2),
      /Syndicated copy/
    );
  });
});
