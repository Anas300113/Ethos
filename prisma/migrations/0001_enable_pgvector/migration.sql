-- Enable pgvector and declare real vector columns.
-- Prisma schema references these via Unsupported("vector(1536)"),
-- so this migration keeps native vector DDL under SQL control.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Story"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

ALTER TABLE "Claim"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

