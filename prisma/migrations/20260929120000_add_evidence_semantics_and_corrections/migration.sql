-- Evidence semantics, source independence, and correction history.
--
-- Deliberately ADDITIVE: nothing is dropped and no row is rewritten, so an
-- existing deployment upgrades in place and a fresh database simply replays
-- this after 0001_init + the ingestion/lifecycle migrations.

-- ---- enums ----------------------------------------------------------------

-- How a fetched document relates to the claim it was retrieved for.
CREATE TYPE "EvidenceRelationship" AS ENUM (
  'SUPPORTS',
  'CONTRADICTS',
  'MENTIONS_ONLY',
  'IRRELEVANT',
  'UNCLEAR'
);

-- Who decided it. AI_HYBRID means a model contributed and the deterministic
-- veto still had the final say; a model verdict never stands alone.
CREATE TYPE "AssessmentMethod" AS ENUM ('DETERMINISTIC', 'AI_HYBRID');

-- Why a published story moved. Corrections and re-assessments are separable
-- from ordinary content updates so the reader can be told differently.
CREATE TYPE "UpdateKind" AS ENUM (
  'PUBLISHED',
  'CONTENT_UPDATE',
  'CLAIM_REASSESSED',
  'CORRECTION'
);

-- ---- what a document actually does to a claim -----------------------------
-- One evidence row is written per (claim, document) pair the pipeline relied
-- on, so a claim-scoped verdict on a story-level row is honest by design.

ALTER TABLE "PrimaryEvidence"
  ADD COLUMN "relationship" "EvidenceRelationship",
  ADD COLUMN "relationshipReason" TEXT,
  ADD COLUMN "supportingPassage" TEXT,
  ADD COLUMN "assessmentMethod" "AssessmentMethod",
  ADD COLUMN "assessmentModel" TEXT,
  ADD COLUMN "assessedAt" TIMESTAMP(3),
  ADD COLUMN "resolvedUrl" TEXT;

-- ---- independence, not outlet arithmetic ----------------------------------
-- Corroboration counts SOURCING GROUPS: three outlets repeating one wire
-- story are one confirmation, not three.

ALTER TABLE "Claim"
  ADD COLUMN "independentSourceCount" INTEGER,
  ADD COLUMN "sourcingNote" TEXT;

ALTER TABLE "ArticleSource"
  ADD COLUMN "sourcingGroup" TEXT,
  ADD COLUMN "sharedSourceLabel" TEXT;

CREATE INDEX "ArticleSource_sourcingGroup_idx" ON "ArticleSource"("sourcingGroup");

-- ---- corrections and re-assessments as first-class history ----------------

ALTER TABLE "StoryUpdate"
  ADD COLUMN "kind" "UpdateKind" NOT NULL DEFAULT 'CONTENT_UPDATE',
  ADD COLUMN "claimStatement" TEXT,
  ADD COLUMN "claimId" TEXT,
  ADD COLUMN "previousState" TEXT,
  ADD COLUMN "newState" TEXT,
  ADD COLUMN "sourceLabel" TEXT,
  ADD COLUMN "evidenceUrl" TEXT;

CREATE INDEX "StoryUpdate_kind_idx" ON "StoryUpdate"("kind");
