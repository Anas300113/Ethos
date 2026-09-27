import { existsSync } from "node:fs";
import process from "node:process";
import { defineConfig } from "prisma/config";

// `prisma.config.ts` replaces the deprecated `package.json#prisma` block
// (the CLI warns on every run while that block is used, and it is removed
// in Prisma 7).
//
// IMPORTANT: once this config file exists the Prisma CLI no longer loads
// `.env` itself. DATABASE_URL must be loaded here or every migrate/seed
// command fails with P1012 "Environment variable not found: DATABASE_URL".
// `process.loadEnvFile` ships with Node >= 20.12, so no extra dependency.
const ENV_FILE = ".env";
if (existsSync(ENV_FILE)) {
  process.loadEnvFile(ENV_FILE);
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed/seed.ts",
  },
});
