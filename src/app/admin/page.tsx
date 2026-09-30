import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { constructProviders } from "@/lib/providers";
import { validateStory } from "@/lib/verification";
import { getStoriesBySlugs } from "@/lib/stories/dal";

// Operator console: always reflects the current pipeline state.
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "text-emerald-700 dark:text-emerald-300",
  UPDATED: "text-emerald-700 dark:text-emerald-300",
  REVALIDATED: "text-emerald-700 dark:text-emerald-300",
  REJECTED: "text-rose-700 dark:text-rose-300",
  ARCHIVED: "text-zinc-500",
};

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default async function AdminPage() {
  const providers = constructProviders();

  const [
    feedRows,
    itemStatus,
    rejectionRows,
    storyStatus,
    storyRows,
    promotedLinks,
    evidenceDocs,
    updates,
  ] = await Promise.all([
    prisma.ingestFeed.findMany({
      include: { publisher: { select: { name: true } } },
      orderBy: { feedUrl: "asc" },
    }),
    prisma.ingestedItem.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.ingestedItem.groupBy({
      by: ["rejectionCode"],
      where: { status: "REJECTED" },
      _count: { _all: true },
      orderBy: { _count: { rejectionCode: "desc" } },
    }),
    prisma.story.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.story.findMany({
      select: {
        slug: true,
        headline: true,
        status: true,
        version: true,
        isDeveloping: true,
        lastUpdated: true,
        _count: { select: { sources: true, claims: true } },
      },
      orderBy: { lastUpdated: "desc" },
      take: 15,
    }),
    prisma.sourcePromotion.count(),
    prisma.primaryEvidence.count(),
    prisma.storyUpdate.findMany({
      select: {
        id: true,
        kind: true,
        whatChanged: true,
        reason: true,
        timestamp: true,
        story: { select: { slug: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 8,
    }),
  ]);

  const stored =
    itemStatus.find((row) => row.status === "STORED")?._count._all ?? 0;
  const rejected =
    itemStatus.find((row) => row.status === "REJECTED")?._count._all ?? 0;
  const published =
    storyStatus.find((row) => row.status === "PUBLISHED")?._count._all ?? 0;

  // Re-run the deterministic gate over what is live: a story that fails now
  // (e.g. after a rules change) is the first thing an operator should see.
  // One batched dossier query for the whole strip, not one per row.
  const gateSlugs = storyRows
    .filter((row) => row.status !== "REJECTED")
    .slice(0, 6)
    .map((row) => row.slug);
  const gateReports = (await getStoriesBySlugs(gateSlugs)).map((story) => ({
    slug: story.slug,
    headline: story.headline,
    gate: validateStory(story),
  }));

  // Provenance roll-up. Anyone who can publish has to be able to answer, in
  // one screen, how much of what we published was judged by a model, how much
  // was extracted by one, how many changes were corrections, and how many
  // "sources" actually share an origin.
  const [methodCounts, provenanceCounts, sourcingGroups, correctionCount] =
    await Promise.all([
      prisma.primaryEvidence.groupBy({
        by: ["assessmentMethod"],
        _count: { _all: true },
      }),
      prisma.claim.groupBy({
        by: ["extractionProvenance"],
        _count: { _all: true },
      }),
      prisma.articleSource.groupBy({
        by: ["sourcingGroup"],
        _count: { _all: true },
      }),
      prisma.storyUpdate.count({ where: { kind: "CORRECTION" } }),
    ]);

  const judgedTotal = methodCounts.reduce(
    (sum, row) => sum + row._count._all,
    0
  );
  const aiJudged =
    methodCounts.find((row) => row.assessmentMethod === "AI_HYBRID")?._count
      ._all ?? 0;
  // "independent:<domain>" is the honest default; anything else means two
  // outlets were found to be printing the same origin.
  const sharedOriginGroups = sourcingGroups.filter(
    (row) =>
      row.sourcingGroup &&
      !row.sourcingGroup.startsWith("independent:") &&
      row._count._all > 1
  ).length;
  const provenanceRows = provenanceCounts
    .map((row) => `${row.extractionProvenance ?? "unset"} (${row._count._all})`)
    .join(" · ");
  const claimsTotal = provenanceCounts.reduce(
    (sum, row) => sum + row._count._all,
    0
  );
  const modelExtracted = provenanceCounts
    .filter((row) => (row.extractionProvenance ?? "").startsWith("remote:"))
    .reduce((sum, row) => sum + row._count._all, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 font-mono text-sm text-slate-800 dark:text-slate-200">
      <header className="flex items-baseline justify-between border-b border-slate-300 dark:border-slate-800 pb-3">
        <div>
          <h1 className="text-base font-semibold uppercase tracking-widest">
            Pipeline console
          </h1>
          <p className="text-xs text-slate-500">
            Ingestion → clustering → claim assessment → publish gate. Not
            linked from the reader UI.
          </p>
        </div>
        <Link href="/" className="text-xs text-slate-500 hover:underline">
          ← reader view
        </Link>
      </header>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Providers
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            label="Mode"
            value={providers.isDevelopmentMode ? "development" : "live"}
          />
          <Stat
            label="AI"
            value={`${providers.report.ai.name} (${providers.report.ai.kind})`}
          />
          <Stat
            label="Evidence"
            value={`${providers.report.evidenceSearch.name} (${providers.report.evidenceSearch.kind})`}
          />
          <Stat label="Fetch" value={providers.report.documentFetch.name} />
        </div>
        <p className="text-xs text-slate-500">
          {providers.evidenceSearch.name === "allowlist-local"
            ? "Local allowlist evidence search returns search URLs, not documents — document grounding is skipped, so CORROBORATED is unreachable by design and claims stop at PARTIALLY_SUPPORTED."
            : "Documents are fetched from the allowlisted domain and grounded against the claim figure before CORROBORATED is allowed."}
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Ingestion
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            label="Feeds"
            value={`${feedRows.filter((feed) => feed.enabled).length}/${feedRows.length} enabled`}
          />
          <Stat label="Stored candidates" value={stored} />
          <Stat label="Rejected" value={rejected} />
          <Stat label="Promoted to sources" value={promotedLinks} />
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Feed</th>
                <th className="px-3 py-2 font-medium">Publisher</th>
                <th className="px-3 py-2 font-medium">Topic</th>
                <th className="px-3 py-2 font-medium">Last run</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {feedRows.map((feed) => (
                <tr key={feed.id} className="bg-white dark:bg-slate-950">
                  <td className="px-3 py-2 max-w-[22rem] truncate" title={feed.feedUrl}>
                    {feed.feedUrl}
                  </td>
                  <td className="px-3 py-2">{feed.publisher.name}</td>
                  <td className="px-3 py-2">{feed.topic}</td>
                  <td className="px-3 py-2">
                    {feed.lastStatus ?? "never"}
                    {feed.lastRunAt
                      ? ` · ${feed.lastRunAt.toISOString().slice(0, 16)}Z`
                      : ""}
                  </td>
                  <td className="px-3 py-2 text-rose-600 dark:text-rose-400 max-w-[16rem] truncate">
                    {feed.lastError ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rejectionRows.length > 0 && (
          <p className="text-xs text-slate-500">
            Rejections:{" "}
            {rejectionRows
              .map(
                (row) => `${row.rejectionCode ?? "UNKNOWN"} ${row._count._all}`
              )
              .join(" · ")}
          </p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Stories
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="Published" value={published} />
          <Stat
            label="Drafts"
            value={storyStatus.find((row) => row.status === "DRAFT")?._count._all ?? 0}
          />
          <Stat
            label="Rejected"
            value={storyStatus.find((row) => row.status === "REJECTED")?._count._all ?? 0}
          />
          <Stat label="Grounded documents" value={evidenceDocs} />
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500">
              <tr className="text-left">
                <th className="px-3 py-2 font-medium">Headline</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Ver</th>
                <th className="px-3 py-2 font-medium">Src</th>
                <th className="px-3 py-2 font-medium">Claims</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {storyRows.map((row) => (
                <tr key={row.slug} className="bg-white dark:bg-slate-950">
                  <td className="px-3 py-2 max-w-[24rem]">
                    <Link
                      href={`/story/${row.slug}`}
                      className="hover:underline"
                      title={row.headline}
                    >
                      {row.headline}
                    </Link>
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      STATUS_TONE[row.status] ?? "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {row.status}
                    {row.isDeveloping ? " *" : ""}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{row.version}</td>
                  <td className="px-3 py-2 tabular-nums">{row._count.sources}</td>
                  <td className="px-3 py-2 tabular-nums">{row._count.claims}</td>
                  <td className="px-3 py-2">
                    {row.lastUpdated.toISOString().slice(0, 16)}Z
                  </td>
                </tr>
              ))}
              {storyRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                    No stories in the database. Run `pnpm curate`.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Publish gate (live re-check)
        </h2>
        {gateReports.map((report) => (
          <div
            key={report.slug}
            className="rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-3 py-2"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-xs">{report.headline}</span>
              <span
                className={
                  report.gate.publishable
                    ? "text-emerald-700 dark:text-emerald-300 text-xs"
                    : "text-rose-700 dark:text-rose-300 text-xs"
                }
              >
                {report.gate.publishable
                  ? "PASS"
                  : `FAIL (${report.gate.issues.length})`}
              </span>
            </div>
            {!report.gate.publishable && (
              <ul className="mt-1 space-y-0.5">
                {report.gate.issues.slice(0, 6).map((issue, index) => (
                  <li
                    key={`${issue.code}-${index}`}
                    className="text-[11px] text-rose-600 dark:text-rose-400"
                  >
                    {issue.code}
                    {issue.claimId ? ` · ${issue.claimId}` : ""}
                    {issue.message ? ` — ${issue.message}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        {gateReports.length === 0 && (
          <p className="text-xs text-slate-500">Nothing published to check.</p>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Provenance &amp; independence
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat
            label="Evidence judged by model"
            value={`${aiJudged} / ${judgedTotal}`}
          />
          <Stat
            label="Claims extracted by model"
            value={`${modelExtracted} / ${claimsTotal}`}
          />
          <Stat label="Corrections logged" value={String(correctionCount)} />
          <Stat
            label="Shared-origin groups"
            value={String(sharedOriginGroups)}
          />
        </div>
        <p className="text-xs text-slate-500">
          Every judgement records the method that produced it; evidence rows
          with no method were decided by policy match alone. Extraction
          provenance: {provenanceRows || "none recorded"}. A shared-origin
          group is two outlets printing the same reporting, counted once by the
          independence rule.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xs uppercase tracking-widest text-slate-500">
          Recent story updates
        </h2>
        <ul className="space-y-1 text-xs">
          {updates.map((update) => (
            <li key={update.id} className="flex gap-2">
              <span className="text-slate-400 shrink-0">
                {update.timestamp.toISOString().slice(0, 16)}Z
              </span>
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wider ${
                  update.kind === "CORRECTION"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400"
                }`}
              >
                {update.kind?.toLowerCase() ?? "update"}
              </span>
              <Link
                href={`/story/${update.story.slug}`}
                className="hover:underline truncate"
              >
                {update.story.slug}
              </Link>
              <span className="text-slate-500 truncate">
                {update.whatChanged}
                {update.reason ? ` — ${update.reason}` : ""}
              </span>
            </li>
          ))}
          {updates.length === 0 && (
            <li className="text-slate-500">
              No updates recorded — re-running curation on a published story
              appends one here.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
