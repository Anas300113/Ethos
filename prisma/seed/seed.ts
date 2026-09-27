/**
 * ETHOS seed script — mirrors src/data/mockStories.json into Postgres.
 *
 * Usage:
 *   pnpm db:seed            # requires DATABASE_URL
 *   pnpm db:seed:dry        # prints planned writes, touches no DB
 *
 * Idempotent: all writes use stable seed ids as primary keys and
 * `upsert` semantics, so re-running never duplicates rows.
 */
import { PrismaClient } from "@prisma/client";
import storiesJson from "../../src/data/mockStories.json";
import type { Story } from "@/types/story";
import { validateStory } from "../../src/lib/verification";
import { resolveStance } from "../../src/lib/stance";

const stories = storiesJson as unknown as Story[];
const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");


function planSummary() {
  const publishers = new Map<string, string>();
  const counts = {
    stories: stories.length,
    claims: 0,
    evidence: 0,
    articles: 0,
    quotes: 0,
    disputes: 0,
    stanceItems: 0,
    stancePoints: 0,
    timeline: 0,
    updates: 0,
  };
  for (const s of stories) {
    counts.claims += s.claims.length;
    counts.evidence += s.primaryEvidence.length;
    counts.articles += s.sources.length;
    counts.stanceItems += s.whereSourcesDiffer.length;
    counts.timeline += s.timeline.length;
    counts.updates += (s.updates ?? []).length;
    for (const src of s.sources) {
      publishers.set(src.publisher.id, src.publisher.name);
    }
    for (const item of s.whereSourcesDiffer) {
      counts.stancePoints += item.points.length;
    }
    for (const c of s.claims) {
      counts.quotes += c.corroboratingSources.length;
      counts.disputes += (c.disputingSources ?? []).length;
    }
  }
  return { counts, publisherCount: publishers.size };
}

async function seedStoryLevel(
  prisma: PrismaClient,
  s: Story
): Promise<void> {
  for (const src of s.sources) {
    await prisma.publisher.upsert({
      where: { id: src.publisher.id },
      update: {
        name: src.publisher.name,
        domain: src.publisher.domain,
        tier: src.publisher.tier,
        country: src.publisher.country ?? null,
      },
      create: {
        id: src.publisher.id,
        name: src.publisher.name,
        domain: src.publisher.domain,
        tier: src.publisher.tier,
        country: src.publisher.country ?? null,
      },
    });
  }

  await prisma.story.upsert({
    where: { slug: s.slug },
    update: {
      headline: s.headline,
      oneSentenceSummary: s.oneSentenceSummary,
      heroImageUrl: s.heroImageUrl ?? null,
      heroImageCaption: s.heroImageCaption ?? null,
      topic: s.topic,
      readingTimeMinutes: s.readingTimeMinutes,
      lastUpdated: new Date(s.lastUpdated),
      version: s.version,
      isDeveloping: s.isDeveloping ?? false,
      whatHappened: s.whatHappened,
      whyItMatters: s.whyItMatters,
      whatWeKnow: s.whatWeKnow,
      whatIsUnclear: s.whatIsUnclear,
      sourcesAgreeOn: s.sourcesAgreeOn,
    },
    create: {
      id: s.id,
      slug: s.slug,
      headline: s.headline,
      oneSentenceSummary: s.oneSentenceSummary,
      heroImageUrl: s.heroImageUrl ?? null,
      heroImageCaption: s.heroImageCaption ?? null,
      topic: s.topic,
      readingTimeMinutes: s.readingTimeMinutes,
      lastUpdated: new Date(s.lastUpdated),
      version: s.version,
      isDeveloping: s.isDeveloping ?? false,
      whatHappened: s.whatHappened,
      whyItMatters: s.whyItMatters,
      whatWeKnow: s.whatWeKnow,
      whatIsUnclear: s.whatIsUnclear,
      sourcesAgreeOn: s.sourcesAgreeOn,
    },
  });

  for (const ev of s.primaryEvidence) {
    await prisma.primaryEvidence.upsert({
      where: { id: ev.id },
      update: {
        title: ev.title,
        url: ev.url ?? null,
        documentType: ev.documentType,
        issuingBody: ev.issuingBody,
        summary: ev.summary,
        date: ev.date ?? null,
        excerpt: ev.excerpt ?? null,
      },
      create: {
        id: ev.id,
        title: ev.title,
        url: ev.url ?? null,
        documentType: ev.documentType,
        issuingBody: ev.issuingBody,
        summary: ev.summary,
        date: ev.date ?? null,
        excerpt: ev.excerpt ?? null,
        storyId: s.id,
      },
    });
  }
}

async function seedClaims(prisma: PrismaClient, s: Story): Promise<void> {
  for (const c of s.claims) {
    await prisma.claim.upsert({
      where: { id: c.id },
      update: {
        statement: c.statement,
        status: c.status,
        confidenceScore: c.confidenceScore,
        explanation: c.explanation,
        lastVerified: new Date(c.lastVerified),
      },
      create: {
        id: c.id,
        statement: c.statement,
        status: c.status,
        confidenceScore: c.confidenceScore,
        explanation: c.explanation,
        lastVerified: new Date(c.lastVerified),
        storyId: s.id,
      },
    });

    for (const ev of c.primaryEvidence) {
      await prisma.primaryEvidence.upsert({
        where: { id: ev.id },
        update: {},
        create: {
          id: ev.id,
          title: ev.title,
          url: ev.url ?? null,
          documentType: ev.documentType,
          issuingBody: ev.issuingBody,
          summary: ev.summary,
          date: ev.date ?? null,
          excerpt: ev.excerpt ?? null,
          storyId: s.id,
        },
      });
      await prisma.claim.update({
        where: { id: c.id },
        data: { primaryEvidence: { connect: { id: ev.id } } },
      });
    }

    await prisma.sourceQuote.deleteMany({ where: { claimId: c.id } });
    for (const q of c.corroboratingSources) {
      await prisma.sourceQuote.create({
        data: {
          publisherName: q.publisherName,
          url: q.url,
          quote: q.quote,
          claimId: c.id,
        },
      });
    }

    await prisma.disputeQuote.deleteMany({ where: { claimId: c.id } });
    for (const q of c.disputingSources ?? []) {
      await prisma.disputeQuote.create({
        data: {
          publisherName: q.publisherName,
          url: q.url,
          quote: q.quote,
          disputeReason: q.disputeReason,
          claimId: c.id,
        },
      });
    }
  }
}

async function seedRelations(
  prisma: PrismaClient,
  s: Story
): Promise<void> {
  for (const src of s.sources) {
    await prisma.articleSource.upsert({
      where: { id: src.id },
      update: {
        url: src.url,
        title: src.title,
        author: src.author ?? null,
        publishedAt: new Date(src.publishedAt),
        retrievedAt: new Date(src.retrievedAt),
        snippet: src.snippet ?? null,
      },
      create: {
        id: src.id,
        url: src.url,
        title: src.title,
        author: src.author ?? null,
        publishedAt: new Date(src.publishedAt),
        retrievedAt: new Date(src.retrievedAt),
        snippet: src.snippet ?? null,
        publisherId: src.publisher.id,
        storyId: s.id,
      },
    });
  }

  for (const item of s.whereSourcesDiffer) {
    await prisma.sourceComparisonItem.upsert({
      where: { id: item.id },
      update: { topic: item.topic },
      create: { id: item.id, topic: item.topic, storyId: s.id },
    });
    await prisma.sourceComparisonPoint.deleteMany({
      where: { itemId: item.id },
    });
    for (const pt of item.points) {
      await prisma.sourceComparisonPoint.create({
        data: {
          sourceName: pt.sourceName,
          reporting: pt.reporting,
          stance: resolveStance(pt),
          itemId: item.id,
        },
      });
    }
  }

  for (const ev of s.timeline) {
    await prisma.timelineEvent.upsert({
      where: { id: ev.id },
      update: {
        timestamp: new Date(ev.timestamp),
        displayTime: ev.displayTime,
        eventText: ev.eventText,
        sourceUrl: ev.sourceUrl ?? null,
        sourceName: ev.sourceName ?? null,
      },
      create: {
        id: ev.id,
        timestamp: new Date(ev.timestamp),
        displayTime: ev.displayTime,
        eventText: ev.eventText,
        sourceUrl: ev.sourceUrl ?? null,
        sourceName: ev.sourceName ?? null,
        storyId: s.id,
      },
    });
  }

  for (const u of s.updates ?? []) {
    await prisma.storyUpdate.upsert({
      where: { id: u.id },
      update: {
        timestamp: new Date(u.timestamp),
        whatChanged: u.whatChanged,
        reason: u.reason ?? null,
      },
      create: {
        id: u.id,
        timestamp: new Date(u.timestamp),
        whatChanged: u.whatChanged,
        reason: u.reason ?? null,
        storyId: s.id,
      },
    });
  }
}

async function main(): Promise<void> {
  const { counts, publisherCount } = planSummary();
  console.log("[ethos:seed] plan", JSON.stringify({ ...counts, publisherCount }));

  // Deterministic publish gate: refuse to persist ungrounded stories.
  const gateResults = stories.map((s) => validateStory(s));
  const failed = gateResults.filter((r) => !r.publishable);
  for (const r of failed) {
    console.error(`[ethos:seed] GATE FAILED ${r.slug} (${r.issues.length} issues)`);
    for (const issue of r.issues) {
      console.error(`  - ${issue.code}: ${issue.message}`);
    }
  }
  if (failed.length > 0 && !FORCE) {
    console.error(
      "[ethos:seed] aborting: ungrounded stories cannot be published. Re-run with --force to override."
    );
    process.exit(1);
  }

  if (DRY_RUN) {
    for (const s of stories) {
      console.log(`[ethos:seed:dry] story ${s.slug} (${s.claims.length} claims)`);
    }
    console.log("[ethos:seed:dry] no writes performed");
    return;
  }

  const prisma = new PrismaClient();
  try {
    for (const s of stories) {
      await seedStoryLevel(prisma, s);
      await seedClaims(prisma, s);
      await seedRelations(prisma, s);
    }
    console.log("[ethos:seed] complete");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[ethos:seed] failed", err);
  process.exit(1);
});

