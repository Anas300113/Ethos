/**
 * Stance-parity CLI: proves the rows stored in Postgres and the JSON data
 * render the SAME stance labels.
 *
 * Both sides are resolved through `resolveStance`, so this fails loudly if a
 * write path ever reintroduces its own default (the blanket
 * `?? "CONFIRMS"` that previously desynced the two paths), or if the database
 * holds stale labels after a data change.
 *
 * TWO SCOPES, because Postgres now has two writers:
 *   1. SEED-AUTHORED stories (slugs present in mockStories.json) — strict
 *      row-for-row parity with the JSON.
 *   2. PIPELINE-PUBLISHED stories (everything the curation pipeline minted) —
 *      no JSON counterpart exists by design, so parity is not meaningful;
 *      what IS meaningful is that every stored label is a real SourceStance
 *      resolved by the write path, never a read-path default.
 *
 * Usage: pnpm stance:check   (requires DATABASE_URL / a seeded database)
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { PrismaClient, SourceStance } from "@prisma/client";
import { getAllStories } from "../src/data/mockStories";
import { resolveStance } from "../src/lib/stance";

// `prisma db seed` loads .env through prisma.config.ts; standalone scripts
// run under tsx must load it themselves.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

type StanceRow = { itemId: string; sourceName: string; stance: string };

/** A stored point plus the story it hangs off, so we can attribute the writer. */
type StanceRowWithStory = StanceRow & { item: { story: { slug: string } } };

/** The labels a write path may legally store, straight from the DB enum. */
const VALID_STANCES = new Set<string>(Object.values(SourceStance));

/** Story slugs owned by the JSON dataset — the strict-parity universe. */
const seedSlugs = new Set(getAllStories().map((story) => story.slug));

const expectedRows: StanceRow[] = getAllStories().flatMap((story) =>
  story.whereSourcesDiffer.flatMap((item) =>
    item.points.map((point) => ({
      itemId: item.id,
      sourceName: point.sourceName,
      stance: resolveStance(point),
    }))
  )
);

function keyOf(row: StanceRow): string {
  return `${row.itemId}::${row.sourceName}`;
}

function distribution(rows: StanceRow[]): string {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.stance, (counts.get(row.stance) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([stance, n]) => `${stance}=${n}`)
    .join(" ");
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    // storySlug lets us split seed-authored rows (strict parity) from
    // pipeline-published ones (label-validity only).
    const rows = (await prisma.sourceComparisonPoint.findMany({
      select: {
        itemId: true,
        sourceName: true,
        stance: true,
        item: { select: { story: { select: { slug: true } } } },
      },
      orderBy: { sourceName: "asc" },
    })) as unknown as StanceRowWithStory[];

    const seedRows = rows.filter((row) => seedSlugs.has(row.item.story.slug));
    const pipelineRows = rows.filter((row) => !seedSlugs.has(row.item.story.slug));

    const expected = new Map(expectedRows.map((row) => [keyOf(row), row.stance]));
    const actual = new Map(seedRows.map((row) => [keyOf(row), row.stance]));

    console.log(`JSON  points: ${expectedRows.length}  [${distribution(expectedRows)}]`);
    console.log(
      `DB    points: ${seedRows.length} seed-authored  [${distribution(seedRows)}]`
    );
    if (pipelineRows.length > 0) {
      console.log(
        `DB    points: ${pipelineRows.length} pipeline-published (checked for valid labels only)`
      );
    }

    let problems = 0;

    for (const [key, stance] of expected) {
      if (!actual.has(key)) {
        problems += 1;
        console.log(`MISSING  ${key} (expected ${stance}, no row in Postgres)`);
        continue;
      }
      if (actual.get(key) !== stance) {
        problems += 1;
        console.log(
          `MISMATCH ${key} (JSON resolves ${stance}, Postgres stores ${actual.get(key)})`
        );
      }
    }

    for (const key of actual.keys()) {
      if (!expected.has(key)) {
        problems += 1;
        console.log(`EXTRA    ${key} (seed row in Postgres with no JSON counterpart)`);
      }
    }

    // Every stored label — seed or pipeline — must be a real SourceStance.
    // This is what catches a write path that stores a blank/`??`-defaulted
    // label and lets the READ path invent the difference.
    for (const row of rows) {
      if (!VALID_STANCES.has(row.stance)) {
        problems += 1;
        console.log(`BAD LABEL ${keyOf(row)} (Postgres stores "${row.stance}")`);
      }
    }

    if (problems > 0) {
      console.log(`\n${problems} stance-parity problem(s). Re-run: pnpm db:seed`);
      process.exit(1);
    }

    console.log(
      "\nStance parity OK: seed rows match the JSON-derived labels, and all " +
        `${rows.length} labels resolve to a real SourceStance.`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
