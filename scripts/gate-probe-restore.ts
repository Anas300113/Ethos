/**
 * Restores src/data/mockStories.json from the probe backup.
 * Usage: pnpm gate:probe:restore
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const target = "src/data/mockStories.json";
const backup = path.join(os.tmpdir(), "ethos-mockStories-backup.json");

if (!fs.existsSync(backup)) {
  console.error("[gate-probe] no backup found at", backup);
  process.exit(1);
}

fs.copyFileSync(backup, target);
fs.unlinkSync(backup);
console.log("[gate-probe] restored", target);
