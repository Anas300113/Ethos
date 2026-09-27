/**
 * Publish-gate probe: temporarily strips grounding from a seeded claim so
 * you can confirm the gate blocks publication, then restore with
 * `pnpm gate:probe:restore`.
 *
 * Usage: pnpm gate:probe:inject && pnpm db:seed:dry
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const target = "src/data/mockStories.json";
const backup = path.join(os.tmpdir(), "ethos-mockStories-backup.json");

if (fs.existsSync(backup)) {
  console.error("[gate-probe] a backup already exists — run restore first:", backup);
  process.exit(1);
}

fs.copyFileSync(target, backup);

const stories = JSON.parse(fs.readFileSync(target, "utf8"));
stories[0].claims[0].primaryEvidence = [];
fs.writeFileSync(target, JSON.stringify(stories, null, 2) + "\n", "utf8");

console.log("[gate-probe] injected violation into", stories[0].claims[0].id);
console.log("[gate-probe] backup at", backup);
