/**
 * Curation CLI: candidates -> stories, through the deterministic publish gate.
 *
 *   pnpm curate            cluster + assess + generate + gate + persist
 *   pnpm curate:dry        everything except the DB writes (story objects are
 *                          assembled and gated, then reported only)
 *
 * Flags: --max-items N, --window-days N.
 * Safe to re-run: an unchanged cluster is skipped with no version bump, so a
 * cron schedule never duplicates stories. Missing AI/evidence credentials are
 * NOT an error — the local providers run and the report says so.
 */
import { existsSync } from "node:fs";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import { runCuration } from "../src/lib/curation/pipeline";
import { constructProviders } from "../src/lib/providers";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");

function numberAfter(flag: string): number | undefined {
  const index = argv.indexOf(flag);
  if (index < 0 || !argv[index + 1]) return undefined;
  const value = Number(argv[index + 1]);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function main(): Promise<number> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. Curation reads candidates and writes stories — it needs a database."
    );
    return 2;
  }
  const prisma = new PrismaClient();
  try {
    const providers = constructProviders();
    const report = await runCuration({
      prisma,
      providers,
      dryRun,
      maxItems: numberAfter("--max-items"),
      windowDays: numberAfter("--window-days"),
      log: (message) => console.log(message),
    });

    console.log(
      JSON.stringify(
        {
          dryRun: report.dryRun,
          candidates: report.candidatesConsidered,
          clusters: report.clustersFound,
          promotable: report.promotable,
          published: report.published.map((p) => p.slug),
          updated: report.updated.map((p) => `${p.slug}@v${p.version}`),
          unchanged: report.unchanged,
          gateBlocked: report.gateBlocked,
          failed: report.failed,
        },
        null,
        2
      )
    );

    // Non-zero only when the run achieved nothing AND there was work to do.
    const nothingWorked =
      report.promotable > 0 &&
      report.published.length === 0 &&
      report.updated.length === 0 &&
      report.unchanged === 0;
    return nothingWorked ? 1 : 0;
  } finally {
    await prisma.$disconnect();
  }
}

main().then(
  (code) => {
    if (code === 0) return;
    setTimeout(() => process.exit(code), 0);
  },
  (error) => {
    console.error(
      `\ncurate failed: ${error instanceof Error ? error.message : String(error)}`
    );
    setTimeout(() => process.exit(1), 0);
  }
);
