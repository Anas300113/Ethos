-- CreateEnum
CREATE TYPE "StoryStatus" AS ENUM ('CANDIDATE', 'CLUSTERED', 'ANALYSING', 'EVIDENCE_REVIEW', 'DRAFT', 'VALIDATING', 'PUBLISHED', 'UPDATED', 'REVALIDATED', 'REJECTED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "ArticleSource" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'REPORTING';

-- AlterTable
ALTER TABLE "Claim" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "claimType" TEXT NOT NULL DEFAULT 'STATEMENT',
ADD COLUMN     "claimant" TEXT,
ADD COLUMN     "extractionProvenance" TEXT NOT NULL DEFAULT 'seed';

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "aiModel" TEXT,
ADD COLUMN     "aiProvider" TEXT,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "pipelineVersion" TEXT NOT NULL DEFAULT 'mvp-1',
ADD COLUMN     "status" "StoryStatus" NOT NULL DEFAULT 'CANDIDATE';

-- CreateTable
CREATE TABLE "ReaderProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReaderProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryBookmark" (
    "readerId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "savedVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryBookmark_pkey" PRIMARY KEY ("readerId","storyId")
);

-- CreateTable
CREATE TABLE "ReaderPreference" (
    "readerId" TEXT NOT NULL,
    "topic" "StoryTopic" NOT NULL,
    "followed" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReaderPreference_pkey" PRIMARY KEY ("readerId","topic")
);

-- CreateTable
CREATE TABLE "ReadingEvent" (
    "id" TEXT NOT NULL,
    "readerId" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReadingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourcePromotion" (
    "id" TEXT NOT NULL,
    "ingestedItemId" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "promotedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "promotedBy" TEXT NOT NULL DEFAULT 'pipeline',

    CONSTRAINT "SourcePromotion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoryBookmark_readerId_createdAt_idx" ON "StoryBookmark"("readerId", "createdAt");

-- CreateIndex
CREATE INDEX "ReadingEvent_readerId_readAt_idx" ON "ReadingEvent"("readerId", "readAt");

-- CreateIndex
CREATE INDEX "ReadingEvent_storyId_readAt_idx" ON "ReadingEvent"("storyId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePromotion_ingestedItemId_key" ON "SourcePromotion"("ingestedItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SourcePromotion_articleId_key" ON "SourcePromotion"("articleId");

-- AddForeignKey
ALTER TABLE "StoryBookmark" ADD CONSTRAINT "StoryBookmark_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryBookmark" ADD CONSTRAINT "StoryBookmark_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReaderPreference" ADD CONSTRAINT "ReaderPreference_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_readerId_fkey" FOREIGN KEY ("readerId") REFERENCES "ReaderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingEvent" ADD CONSTRAINT "ReadingEvent_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePromotion" ADD CONSTRAINT "SourcePromotion_ingestedItemId_fkey" FOREIGN KEY ("ingestedItemId") REFERENCES "IngestedItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourcePromotion" ADD CONSTRAINT "SourcePromotion_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "ArticleSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
