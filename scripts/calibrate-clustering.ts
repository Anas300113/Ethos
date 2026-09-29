/** Calibration: similarity + merge decision for real IngestedItem pairs. */
import { existsSync, createWriteStream } from "node:fs";
import process from "node:process";
import { PrismaClient } from "@prisma/client";
import {
  articleSimilarity,
  hardSignalOverlap,
  hasSameEventSignal,
  MERGE_THRESHOLD,
  significantTokens,
} from "../src/lib/curation/cluster";

if (existsSync(".env")) process.loadEnvFile(".env");

const out = createWriteStream("tmp-sim-matrix.txt", { encoding: "utf8" });

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.ingestedItem.findMany({
      where: { status: "STORED" },
      include: { feed: { include: { publisher: true } } },
    });
    const articles = rows.map((row) => ({
      id: row.id,
      url: row.url,
      title: row.title,
      excerpt: row.excerpt,
      topic: row.topic,
      publishedAt: row.publishedAt,
      publisherName: row.feed.publisher.name,
    }));
    const pairs: {
      score: number;
      a: string;
      b: string;
      pubA: string;
      pubB: string;
      figures: number;
      entities: number;
      signal: boolean;
    }[] = [];
    for (let i = 0; i < articles.length; i += 1) {
      for (let j = i + 1; j < articles.length; j += 1) {
        if (articles[i].topic !== articles[j].topic) continue;
        const overlap = hardSignalOverlap(articles[i], articles[j]);
        pairs.push({
          score: articleSimilarity(articles[i], articles[j]),
          a: articles[i].title.slice(0, 62),
          b: articles[j].title.slice(0, 62),
          pubA: articles[i].publisherName,
          pubB: articles[j].publisherName,
          figures: overlap.figures,
          entities: overlap.entities,
          signal: hasSameEventSignal(articles[i], articles[j]),
        });
      }
    }
    pairs.sort((x, y) => y.score - x.score);
    out.write(`MERGE_THRESHOLD=${MERGE_THRESHOLD}\n`);
    // Focused dump: the cross-publisher same-event candidate (hurricane).
    for (const article of articles) {
      if (!/hurricane/i.test(article.title)) continue;
      out.write(
        `TOKENS ${article.publisherName}: ${article.title}\n  ` +
          `${significantTokens(article).join(" | ")}\n`
      );
    }
    out.write("score | figures | entities | sameEvent | crossPublisher | pair\n");
    for (const pair of pairs.slice(0, 20)) {
      out.write(
        `${pair.score.toFixed(3)} | ${pair.figures} | ${pair.entities} | ` +
          `${pair.signal} | ${pair.pubA !== pair.pubB} | ${pair.pubA}: ${pair.a}\n` +
          `                                                  x ${pair.pubB}: ${pair.b}\n`
      );
    }
    out.write("\ndone\n");
  } finally {
    out.end();
    await prisma.$disconnect();
  }
}

main();