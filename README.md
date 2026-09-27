# ETHOS — Evidence-First News Intelligence

ETHOS synthesises multi-source reporting around **discrete claims** and grounds
each claim in **primary evidence** (treaties, statutory releases, court filings,
parliamentary records). No claim reaches a reader without passing a
deterministic publish gate.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router, React, TypeScript) |
| Styling | Tailwind CSS v4 + editorial design tokens in `src/app/globals.css` |
| Icons | lucide-react |
| Persistence | Prisma + PostgreSQL (pgvector-ready) |
| Tests | Node's built-in `node:test` via `tsx` |

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build (type-checks)
pnpm lint             # eslint
pnpm test             # verification harness unit tests

pnpm gate:check       # validate every seeded story against the publish gate
pnpm gate:probe:inject    # temporarily break seed data to prove the gate blocks
pnpm gate:probe:restore   # undo the probe

pnpm db:generate      # prisma client
pnpm db:seed:dry      # print planned writes + gate results (no DB needed)
pnpm db:seed          # write seed data (aborts if the gate blocks a story)
pnpm db:studio        # browse data
```

## Local database

ETHOS needs Postgres with **pgvector**. A one-off container, here on port **5433**
because 5432 was already taken by another local project (`traffy-postgres`) —
pick any free port:

```bash
docker run -d --name ethos-postgres \
  -e POSTGRES_USER=ethos -e POSTGRES_PASSWORD=ethos -e POSTGRES_DB=ethos \
  -p 5433:5432 -v ethos-pgdata:/var/lib/postgresql/data \
  pgvector/pgvector:pg16
```

Then copy `.env.example` → `.env` (`.env` is gitignored) and point
`DATABASE_URL` at that port:

```bash
pnpm db:migrate     # applies prisma/migrations
pnpm db:seed        # gate-checked, idempotent write of the seed dossiers
```

`pnpm db:seed` routes through `prisma db seed` so the Prisma CLI loads `.env`
first — plain `tsx prisma/seed/seed.ts` fails with `P1012 DATABASE_URL not found`
because **`PrismaClient` does not read `.env` itself**, only the CLI does.

`prisma/migrations/0001_init/migration.sql` opens with
`CREATE EXTENSION IF NOT EXISTS vector;` because `Story.embedding` and
`Claim.embedding` declare `vector(1536)` — that type must exist before those
`CREATE TABLE` statements run. `pnpm db:migrate` ordering is safe to verify with
`prisma migrate status`.

## Verification harness (`src/lib/verification.ts`)

Pure functions — no DB, no network, no model inference — so results are
reproducible and testable.

| Rule | Enforced |
| --- | --- |
| `SUPPORTED` / `CORROBORATED` | requires ≥1 primary evidence doc **and** ≥1 corroborating quote |
| `PARTIALLY_SUPPORTED` | requires evidence **or** corroboration |
| `DISPUTED` / `CONTRADICTED` | requires ≥1 disputing source with a non-empty reason |
| Fair use | quotes, snippets and excerpts capped at **250 characters** |
| URLs | every citation must be a valid `http(s)` URL |
| Confidence | must be within `[0, 1]` |
| Timeline | timestamps must be non-decreasing |
| Completeness | a story must carry at least one claim and one source |

`validateStory()` returns `{ publishable, issues[] }`. The seed script refuses to
persist a blocked story unless `--force` is passed, and the story dossier UI
surfaces the same result in the Verification Gate card.

## Layout

```
src/app/                 Today feed, For You, Search, Saved, story dossiers
src/components/story/    StoryCard + detail sections (gate, claims, analysis)
src/components/ui/       ClaimBadge, StanceLabel
src/lib/verification.ts  Deterministic publish gate
src/data/                Seed dataset (mockStories.json + typed accessors)
prisma/                  Schema, pgvector migration, idempotent seed
scripts/                 Gate CLI + probes
```

## Data flow

1. `src/data/mockStories.json` is the canonical seed dossier set.
2. `prisma/seed/seed.ts` mirrors it into Postgres (stable IDs, upserts, gate-checked).
3. Pages read through `src/data/mockStories.ts` accessors today; swapping those
   for Prisma queries is the next increment.

