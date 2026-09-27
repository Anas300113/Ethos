import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { inferStance, resolveStance, type StancePoint } from "@/lib/stance";
import { MOCK_STORIES } from "@/data/mockStories";

type SeedPoint = StancePoint & { sourceName: string };

function seededPoints(): SeedPoint[] {
  return MOCK_STORIES.flatMap((story) =>
    story.whereSourcesDiffer.flatMap((item) => item.points)
  );
}

describe("inferStance", () => {
  it("maps dispute signals to DISPUTES", () => {
    assert.equal(inferStance("Warns deliveries are unlikely to land."), "DISPUTES");
    assert.equal(
      inferStance("Notes they may only adhere when deploying in signatory borders."),
      "DISPUTES"
    );
    assert.equal(
      inferStance("Highlights friction between backbenchers and ministers."),
      "DISPUTES"
    );
  });

  it("maps framing signals to ADDS_CONTEXT", () => {
    assert.equal(inferStance("Focuses on the fiscal impact and debt headroom."), "ADDS_CONTEXT");
    assert.equal(
      inferStance("Highlights the emotional appeals from delegates."),
      "ADDS_CONTEXT"
    );
  });

  it("falls back to CONFIRMS when nothing matches", () => {
    assert.equal(inferStance("Argues the treaty retains substantial authority."), "CONFIRMS");
  });
});

describe("resolveStance", () => {
  it("prefers an explicit author stance over inference", () => {
    assert.equal(
      resolveStance({ reporting: "Warns it will fail.", stance: "OMITS" }),
      "OMITS"
    );
  });

  it("infers when no explicit stance is given", () => {
    assert.equal(resolveStance({ reporting: "Warns deliveries are unlikely." }), "DISPUTES");
  });

  it("agrees with itself across a database round-trip for every seeded point", () => {
    for (const point of seededPoints()) {
      const written = resolveStance(point); // what the seed persists
      const reread = resolveStance({ ...point, stance: written }); // what the UI reads back
      assert.equal(
        reread,
        written,
        `${point.sourceName}: JSON path and Postgres path must render the same label`
      );
    }
  });

  it("yields a mixed set for the seed data, not a blanket CONFIRMS", () => {
    const labels = new Set(seededPoints().map((p) => resolveStance(p)));
    assert.ok(labels.size > 1, "seeded points must span more than one stance label");
    assert.ok(labels.has("DISPUTES"), "seeded data must contain at least one DISPUTES");
    assert.ok(labels.has("ADDS_CONTEXT"), "seeded data must contain at least one ADDS_CONTEXT");
  });

  it("resolves every seeded point", () => {
    for (const point of seededPoints()) {
      const resolved = resolveStance(point);
      assert.ok(resolved.length > 0, "stance must not be empty");
    }
  });
});

describe("seed write path uses resolveStance as its only stance source", () => {
  it("does not reintroduce a hard-coded CONFIRMS fallback", () => {
    const seedSource = fs.readFileSync(
      path.join(process.cwd(), "prisma", "seed", "seed.ts"),
      "utf8"
    );
    assert.ok(
      seedSource.includes("resolveStance(pt)"),
      "seed must resolve stances through the shared helper"
    );
    assert.ok(
      !seedSource.includes('?? "CONFIRMS"'),
      "seed must not fall back to CONFIRMS (that desyncs JSON and Postgres rendering)"
    );
  });
});
