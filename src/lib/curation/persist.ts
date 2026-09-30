/**
 * Persistence for a gate-approved story. The ONLY module that writes the
 * curated Story graph from the curation pipeline (seed.ts writes separately).
 *
 * Rules enforced here, not trusted to callers:
 *   - validateStory must pass; otherwise this throws and nothing is written.
 *   - Stance labels go through resolveStance (never `?? "CONFIRMS"`).
 *   - Updates APPEND StoryUpdate history — prior versions are never erased.
 *   - IngestedItem rows are only read (promotion links), never mutated here.
 */
import type { PrismaClient } from "@prisma/client";
import type { Story } from "@/types/story";
import { resolveStance } from "@/lib/stance";
import { validateStory } from "@/lib/verification";

export interface PersistOptions {
  /** Claim extraction provenance label for every row, e.g. "local-regex@1". */
  extractionProvenance: string;
  aiProvider?: string | null;
  aiModel?: string | null;
  generatedAt?: Date;
  /** Set when an existing story was refreshed; appended as a What-changed note. */
  updateSummary?: string;
}

export interface PersistResult {
  storyId: string;
  slug: string;
  created: boolean;
  version: number;
}

type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

async function ensurePublisher(
  tx: Tx,
  publisher: { name: string; domain: string; tier: string }
): Promise<string> {
  const existing = await tx.publisher.findUnique({
    where: { domain: publisher.domain },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await tx.publisher.create({
    data: {
      name: publisher.name,
      domain: publisher.domain,
      // Surfacing through the curation pipeline is not hand-vetting: second
      // tier only. Tier upgrades stay an editorial decision.
      tier: "SECONDARY_TIER2",
    },
  });
  return created.id;
}

export async function persistStory(
  prisma: PrismaClient,
  story: Story,
  options: PersistOptions
): Promise<PersistResult> {
  const gate = validateStory(story);
  if (!gate.publishable) {
    throw new Error(
      `refusing to persist ${story.slug}: gate blocked with ${gate.issues.length} issue(s): ` +
        gate.issues.map((i) => i.code).join(", ")
    );
  }

  const existing = await prisma.story.findUnique({
    where: { slug: story.slug },
    select: { id: true, version: true },
  });
  const created = existing === null;
  const version = created ? 1 : existing.version + 1;
  const now = new Date(story.lastUpdated);

  const storyRow = await prisma.story.upsert({
    where: { slug: story.slug },
    update: {
      headline: story.headline,
      oneSentenceSummary: story.oneSentenceSummary,
      topic: story.topic,
      readingTimeMinutes: story.readingTimeMinutes,
      lastUpdated: now,
      version,
      status: "UPDATED",
      whatHappened: story.whatHappened,
      whyItMatters: story.whyItMatters,
      whatWeKnow: story.whatWeKnow,
      whatIsUnclear: story.whatIsUnclear,
      sourcesAgreeOn: story.sourcesAgreeOn,
      pipelineVersion: "mvp-1",
      aiProvider: options.aiProvider ?? null,
      aiModel: options.aiModel ?? null,
      generatedAt: options.generatedAt ?? now,
    },
    create: {
      slug: story.slug,
      headline: story.headline,
      oneSentenceSummary: story.oneSentenceSummary,
      topic: story.topic,
      readingTimeMinutes: story.readingTimeMinutes,
      lastUpdated: now,
      version: 1,
      status: "PUBLISHED",
      whatHappened: story.whatHappened,
      whyItMatters: story.whyItMatters,
      whatWeKnow: story.whatWeKnow,
      whatIsUnclear: story.whatIsUnclear,
      sourcesAgreeOn: story.sourcesAgreeOn,
      pipelineVersion: "mvp-1",
      aiProvider: options.aiProvider ?? null,
      aiModel: options.aiModel ?? null,
      generatedAt: options.generatedAt ?? now,
    },
    select: { id: true },
  });
  const storyId = storyRow.id;

  await replaceChildren(prisma, story, storyId, options);

  if (options.updateSummary) {
    await prisma.storyUpdate.create({
      data: {
        timestamp: now,
        whatChanged: options.updateSummary.slice(0, 2000),
        reason: "pipeline",
        storyId,
      },
    });
  }

  return { storyId, slug: story.slug, created, version };
}

/**
 * Replace every derived child row in ONE transaction so a crash mid-write
 * never leaves a story with sources but no claims (cascade deletes handle
 * quotes, points, and promotion rows beneath the roots).
 */
async function replaceChildren(
  prisma: PrismaClient,
  story: Story,
  storyId: string,
  options: PersistOptions
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.claim.deleteMany({ where: { storyId } });
    await tx.primaryEvidence.deleteMany({ where: { storyId } });
    await tx.articleSource.deleteMany({ where: { storyId } });
    await tx.sourceComparisonItem.deleteMany({ where: { storyId } });
    await tx.timelineEvent.deleteMany({ where: { storyId } });

    // ---- Sources (reporting) + promotion fast-path links ----
    for (const source of story.sources) {
      const publisherId = await ensurePublisher(tx, source.publisher);
      const article = await tx.articleSource.create({
        data: {
          url: source.url,
          title: source.title,
          author: source.author ?? null,
          snippet: source.snippet ?? null,
          publishedAt: new Date(source.publishedAt),
          retrievedAt: new Date(source.retrievedAt),
          publisherId,
          storyId,
          role: "REPORTING",
          sourcingGroup: source.sourcingGroup ?? null,
          sharedSourceLabel: source.sharedSourceLabel ?? null,
        },
      });
      const ingested = await tx.ingestedItem.findUnique({
        where: { url: source.url },
        select: { id: true },
      });
      if (ingested) {
        await tx.sourcePromotion.create({
          data: { ingestedItemId: ingested.id, articleId: article.id },
        });
      }
    }

    // ---- Primary evidence (story-level; claims connect below) ----
    const evidenceIds = new Map<string, string>();
    for (const ev of story.primaryEvidence) {
      const row = await tx.primaryEvidence.create({
        data: {
          title: ev.title,
          url: ev.url ?? null,
          documentType: ev.documentType,
          issuingBody: ev.issuingBody,
          summary: ev.summary,
          date: ev.date ?? null,
          excerpt: ev.excerpt ?? null,
          relationship: ev.relationship ?? null,
          relationshipReason: ev.relationshipReason ?? null,
          supportingPassage: ev.supportingPassage ?? null,
          assessmentMethod: ev.assessmentMethod ?? null,
          assessmentModel: ev.assessmentModel ?? null,
          assessedAt: ev.relationship ? new Date(story.lastUpdated) : null,
          storyId,
        },
      });
      evidenceIds.set(ev.id, row.id);
    }

    // ---- Claims + their quotes ----
    for (const claim of story.claims) {
      const claimRow = await tx.claim.create({
        data: {
          statement: claim.statement,
          status: claim.status,
          confidenceScore: claim.confidenceScore,
          explanation: claim.explanation,
          lastVerified: new Date(claim.lastVerified),
          storyId,
          claimType: claim.claimType ?? "STATEMENT",
          claimant: claim.claimant ?? null,
          // Per-claim label wins: it distinguishes remote extraction from a
          // deterministic fallback inside the same story.
          extractionProvenance: claim.extractionProvenance ?? options.extractionProvenance,
          aiProvider: options.aiProvider ?? null,
          aiModel: options.aiModel ?? null,
          independentSourceCount: claim.independentSourceCount ?? null,
          sourcingNote: claim.sourcingNote ?? null,
        },
      });
      const evidenceToConnect = claim.primaryEvidence
        .map((ev) => evidenceIds.get(ev.id))
        .filter((id): id is string => Boolean(id));
      if (evidenceToConnect.length > 0) {
        await tx.claim.update({
          where: { id: claimRow.id },
          data: { primaryEvidence: { connect: evidenceToConnect.map((id) => ({ id })) } },
        });
      }
      for (const quote of claim.corroboratingSources) {
        await tx.sourceQuote.create({
          data: {
            publisherName: quote.publisherName,
            url: quote.url,
            quote: quote.quote.slice(0, 250),
            claimId: claimRow.id,
          },
        });
      }
      for (const quote of claim.disputingSources ?? []) {
        await tx.disputeQuote.create({
          data: {
            publisherName: quote.publisherName,
            url: quote.url,
            quote: quote.quote.slice(0, 250),
            disputeReason: quote.disputeReason.slice(0, 500),
            claimId: claimRow.id,
          },
        });
      }
    }

    // ---- Where sources differ (stance resolved centrally) ----
    for (const item of story.whereSourcesDiffer) {
      const itemRow = await tx.sourceComparisonItem.create({
        data: { topic: item.topic, storyId },
      });
      for (const point of item.points) {
        await tx.sourceComparisonPoint.create({
          data: {
            sourceName: point.sourceName,
            reporting: point.reporting,
            stance: resolveStance(point),
            itemId: itemRow.id,
          },
        });
      }
    }

    // ---- Timeline (publication order already enforced by assemble) ----
    for (const event of story.timeline) {
      await tx.timelineEvent.create({
        data: {
          timestamp: new Date(event.timestamp),
          displayTime: event.displayTime,
          eventText: event.eventText,
          sourceUrl: event.sourceUrl ?? null,
          sourceName: event.sourceName ?? null,
          storyId,
        },
      });
    }
  });
}

