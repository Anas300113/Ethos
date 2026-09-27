/**
 * Stance-parity CLI: proves the rows stored in Postgres and the JSON data
 * render the SAME stance labels.
 *
 * Both sides are resolved through `resolveStance`, so this fails loudly if a
 * write path ever reintroduces its own default (the blanket
 * `?? "CONFIRMS"` that previously desynced the two paths), or if the database
 * holds stale labels after a data change.
 *
 * Usage: pnpm stance:check   (requires DATABASE_URL / a seeded database)
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { getAllStories } from "../src/data/mockStories";
import { resolveStance } from "../src/lib/stance";

// `prisma db seed` loads .env through prisma.config.ts; standalone scripts
// run under tsx must load it themselves.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

type StanceRow = { itemId: string; sourceName: string; stance: string };

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
    const dbRows = (await prisma.sourceComparisonPoint.findMany({
      select: { itemId: true, sourceName: true, stance: true },
      orderBy: { sourceName: "asc" },
    })) as StanceRow[];

    const expected = new Map(expectedRows.map((row) => [keyOf(row), row.stance]));
    const actual = new Map(dbRows.map((row) => [keyOf(row), row.stance]));

    console.log(`JSON  points: ${expectedRows.length}  [${distribution(expectedRows)}]`);
    console.log(`DB    points: ${dbRows.length}  [${distribution(dbRows)}]`);

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
        console.log(`EXTRA    ${key} (row in Postgres with no JSON counterpart)`);
      }
    }

    if (problems > 0) {
      console.log(`\n${problems} stance-parity problem(s). Re-run: pnpm db:seed`);
      process.exit(1);
    }

    console.log("\nStance parity OK: Postgres matches the JSON-derived labels.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
