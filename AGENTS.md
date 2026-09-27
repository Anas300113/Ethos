<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Operational safety (agent rules)

### Never dump container configuration

This Docker host is **shared with unrelated projects** (`traffy-postgres`,
others). Commands like `docker inspect <ctr>`, `docker ps --inspect`, or
`docker inspect -f '{{json .Config.Env}}'` print **every container's
environment variables in plaintext** — including other projects' `DATABASE_URL`
credentials and API keys. They land in scrollback, shell history, CI logs and
anything pasted from it.

Inspect state through the database instead:

```bash
docker exec ethos-postgres psql -U ethos -d ethos -c 'SELECT ...'
```

### Never echo secrets

Do not paste a connection string, token, or `.env` value into terminal output,
commits, logs, screenshots, or PR/issue threads. When a script needs user/dbname,
parse them from `.env` at runtime (`process.loadEnvFile`) instead of copying a
connection string into a command line.

### Prisma configuration

`prisma.config.ts` — not the deprecated `package.json#prisma` block — configures
the Prisma CLI, and it is **responsible for loading `.env`** (the CLI explicitly
skips its own dotenv loading once a config file exists). Keep
`process.loadEnvFile(".env")` there, or `pnpm db:seed` fails with
`P1012 Environment variable not found: DATABASE_URL`.

### Stance labels

Resolve stances through `resolveStance()` in `src/lib/stance.ts` on **both** the
seed write path and the dossier UI read path. Do not introduce a local default
such as `?? "CONFIRMS"` — that is exactly what desynced the Postgres rows from
the JSON-rendered labels. Run `pnpm stance:check` after changing seed data.

