-- CreateEnum
CREATE TYPE "FeedFormat" AS ENUM ('RSS_2_0', 'ATOM_1_0', 'RSS_1_0');

-- CreateEnum
CREATE TYPE "FeedRunStatus" AS ENUM ('OK', 'NOT_MODIFIED', 'REJECTED', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestedStatus" AS ENUM ('STORED', 'REJECTED');

-- CreateEnum
CREATE TYPE "IngestedRejection" AS ENUM ('BAD_URL', 'EMPTY_TITLE', 'OFF_DOMAIN', 'OFF_TOPIC', 'STALE', 'MISSING_DATE', 'DUPLICATE_IN_FEED');

-- CreateEnum
CREATE TYPE "DateProvenance" AS ENUM ('PUBLISHED', 'MODIFIED', 'FETCHED');

-- CreateTable
CREATE TABLE "IngestFeed" (
    "id" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "publisherId" TEXT NOT NULL,
    "format" "FeedFormat" NOT NULL DEFAULT 'RSS_2_0',
    "topic" "StoryTopic" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "etag" TEXT,
    "lastModified" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" "FeedRunStatus",
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestFeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestedItem" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "excerpt" TEXT,
    "guid" TEXT,
    "feedId" TEXT NOT NULL,
    "topic" "StoryTopic" NOT NULL,
    "status" "IngestedStatus" NOT NULL DEFAULT 'STORED',
    "rejectionCode" "IngestedRejection",
    "rejectionReason" TEXT,
    "seenCount" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "publishedSource" "DateProvenance" NOT NULL DEFAULT 'PUBLISHED',
    "publishedRaw" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "contentHash" TEXT NOT NULL,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IngestFeed_feedUrl_key" ON "IngestFeed"("feedUrl");

-- CreateIndex
CREATE INDEX "IngestFeed_enabled_idx" ON "IngestFeed"("enabled");

-- CreateIndex
CREATE INDEX "IngestFeed_publisherId_idx" ON "IngestFeed"("publisherId");

-- CreateIndex
CREATE UNIQUE INDEX "IngestedItem_url_key" ON "IngestedItem"("url");

-- CreateIndex
CREATE INDEX "IngestedItem_feedId_idx" ON "IngestedItem"("feedId");

-- CreateIndex
CREATE INDEX "IngestedItem_publishedAt_idx" ON "IngestedItem"("publishedAt");

-- CreateIndex
CREATE INDEX "IngestedItem_topic_idx" ON "IngestedItem"("topic");

-- CreateIndex
CREATE INDEX "IngestedItem_status_publishedAt_idx" ON "IngestedItem"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "IngestFeed" ADD CONSTRAINT "IngestFeed_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "Publisher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestedItem" ADD CONSTRAINT "IngestedItem_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "IngestFeed"("id") ON DELETE CASCADE ON UPDATE CASCADE;
