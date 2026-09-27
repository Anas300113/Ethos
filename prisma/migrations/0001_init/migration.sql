-- Enable pgvector BEFORE any CREATE TABLE that declares a vector(1536) column.
-- pgvector installs the type, so the extension must exist first.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "SourceTier" AS ENUM ('PRIMARY', 'SECONDARY_TIER1', 'SECONDARY_TIER2', 'FACT_CHECKER');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('SUPPORTED', 'CORROBORATED', 'PARTIALLY_SUPPORTED', 'DISPUTED', 'UNVERIFIED', 'CONTRADICTED', 'OUTDATED');

-- CreateEnum
CREATE TYPE "StoryTopic" AS ENUM ('UK', 'World', 'Technology', 'Science', 'Business', 'Climate', 'Sport', 'Culture', 'Health', 'Education');

-- CreateEnum
CREATE TYPE "EvidenceDocumentType" AS ENUM ('STATISTICAL_RELEASE', 'GOVERNMENT_DOCUMENT', 'COURT_FILING', 'OFFICIAL_STATEMENT', 'PARLIAMENTARY_RECORD', 'ACADEMIC_PAPER');

-- CreateEnum
CREATE TYPE "SourceStance" AS ENUM ('CONFIRMS', 'ADDS_CONTEXT', 'DISPUTES', 'OMITS');

-- CreateTable
CREATE TABLE "Publisher" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "tier" "SourceTier" NOT NULL,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Publisher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "oneSentenceSummary" TEXT NOT NULL,
    "heroImageUrl" TEXT,
    "heroImageCaption" TEXT,
    "topic" "StoryTopic" NOT NULL,
    "readingTimeMinutes" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isDeveloping" BOOLEAN NOT NULL DEFAULT false,
    "whatHappened" TEXT NOT NULL,
    "whyItMatters" TEXT NOT NULL,
    "whatWeKnow" TEXT[],
    "whatIsUnclear" TEXT[],
    "sourcesAgreeOn" TEXT[],
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "explanation" TEXT NOT NULL,
    "lastVerified" TIMESTAMP(3) NOT NULL,
    "storyId" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrimaryEvidence" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "documentType" "EvidenceDocumentType" NOT NULL,
    "issuingBody" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "date" TEXT,
    "excerpt" TEXT,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrimaryEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArticleSource" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "retrievedAt" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "publisherId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceQuote" (
    "id" TEXT NOT NULL,
    "publisherName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputeQuote" (
    "id" TEXT NOT NULL,
    "publisherName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "disputeReason" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DisputeQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceComparisonItem" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceComparisonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceComparisonPoint" (
    "id" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "reporting" TEXT NOT NULL,
    "stance" "SourceStance" NOT NULL DEFAULT 'CONFIRMS',
    "itemId" TEXT NOT NULL,

    CONSTRAINT "SourceComparisonPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "displayTime" TEXT NOT NULL,
    "eventText" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceName" TEXT,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryUpdate" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "whatChanged" TEXT NOT NULL,
    "reason" TEXT,
    "storyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RelatedStories" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_RelatedStories_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ClaimToPrimaryEvidence" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ClaimToPrimaryEvidence_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Publisher_domain_key" ON "Publisher"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Story_slug_key" ON "Story"("slug");

-- CreateIndex
CREATE INDEX "Story_topic_idx" ON "Story"("topic");

-- CreateIndex
CREATE INDEX "Claim_storyId_idx" ON "Claim"("storyId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "PrimaryEvidence_storyId_idx" ON "PrimaryEvidence"("storyId");

-- CreateIndex
CREATE INDEX "PrimaryEvidence_issuingBody_idx" ON "PrimaryEvidence"("issuingBody");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleSource_url_key" ON "ArticleSource"("url");

-- CreateIndex
CREATE INDEX "ArticleSource_storyId_idx" ON "ArticleSource"("storyId");

-- CreateIndex
CREATE INDEX "ArticleSource_publisherId_idx" ON "ArticleSource"("publisherId");

-- CreateIndex
CREATE INDEX "SourceQuote_claimId_idx" ON "SourceQuote"("claimId");

-- CreateIndex
CREATE INDEX "DisputeQuote_claimId_idx" ON "DisputeQuote"("claimId");

-- CreateIndex
CREATE INDEX "SourceComparisonItem_storyId_idx" ON "SourceComparisonItem"("storyId");

-- CreateIndex
CREATE INDEX "SourceComparisonPoint_itemId_idx" ON "SourceComparisonPoint"("itemId");

-- CreateIndex
CREATE INDEX "TimelineEvent_storyId_idx" ON "TimelineEvent"("storyId");

-- CreateIndex
CREATE INDEX "TimelineEvent_timestamp_idx" ON "TimelineEvent"("timestamp");

-- CreateIndex
CREATE INDEX "StoryUpdate_storyId_idx" ON "StoryUpdate"("storyId");

-- CreateIndex
CREATE INDEX "_RelatedStories_B_index" ON "_RelatedStories"("B");

-- CreateIndex
CREATE INDEX "_ClaimToPrimaryEvidence_B_index" ON "_ClaimToPrimaryEvidence"("B");

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrimaryEvidence" ADD CONSTRAINT "PrimaryEvidence_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSource" ADD CONSTRAINT "ArticleSource_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleSource" ADD CONSTRAINT "ArticleSource_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceQuote" ADD CONSTRAINT "SourceQuote_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputeQuote" ADD CONSTRAINT "DisputeQuote_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceComparisonItem" ADD CONSTRAINT "SourceComparisonItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceComparisonPoint" ADD CONSTRAINT "SourceComparisonPoint_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "SourceComparisonItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryUpdate" ADD CONSTRAINT "StoryUpdate_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedStories" ADD CONSTRAINT "_RelatedStories_A_fkey" FOREIGN KEY ("A") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RelatedStories" ADD CONSTRAINT "_RelatedStories_B_fkey" FOREIGN KEY ("B") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimToPrimaryEvidence" ADD CONSTRAINT "_ClaimToPrimaryEvidence_A_fkey" FOREIGN KEY ("A") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ClaimToPrimaryEvidence" ADD CONSTRAINT "_ClaimToPrimaryEvidence_B_fkey" FOREIGN KEY ("B") REFERENCES "PrimaryEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

