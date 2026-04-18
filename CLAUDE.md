# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common commands

```bash
npm run dev              # Next.js dev server on :3000
npm run build            # Production build
npm run typecheck        # tsc --noEmit (strict)
npm test                 # vitest run (one-shot)
npm run test:watch       # vitest watch mode
npm run lint             # next lint

npm run db:generate      # Generate SQL migration from schema changes
npm run db:push          # Apply schema to Neon directly (no migration file)
npm run db:migrate       # Apply generated migrations
npm run db:seed          # Insert the 3 system templates (src/db/seed.ts)
```

Run a single test file: `npx vitest run src/lib/youtube.test.ts`.

Ad-hoc scripts (require a live `.env.local`):
```bash
npx tsx scripts/test-transcript.ts "<youtube url>"   # Supadata only
npx tsx scripts/test-summary.ts    "<youtube url>"   # full pipeline → LLM
```

## Architecture

Kura turns a YouTube URL into a structured Markdown note. Request flow:

1. `POST /api/summaries` (`src/app/api/summaries/route.ts`) — auth, parse URL, upsert `videos` stub, **dedupe** per `(userId, videoId)`, atomically increment quota, insert `summaries` row with `status: 'pending'`, schedule `processSummary` via Next's `after()` and return `summaryId`.
2. `processSummary` (`src/lib/worker/process-summary.ts`) runs out-of-band: fetches transcript via Supadata, hard-rejects videos > 2h, calls Gemini, writes `content`/`status: 'ready'`. On failure it refunds the quota.
3. Client polls `GET /api/summaries/[id]`; when `ready`, `/app/summaries/[id]` renders the content via the template's `markdownTemplate` (Handlebars).

Because the worker is `after()` — not a queue — **Vercel Fluid Compute must be enabled** in prod so the response doesn't cut off background work. There is no retry queue; `POST /api/summaries/[id]/retry` re-runs `processSummary` on demand.

### Quota (`src/lib/quota.ts`)

- Monthly counter on `users` with a `monthlyUsageResetAt` timestamp.
- `checkAndIncrementQuota` is the single write path: it rolls the counter over lazily when the reset time has passed, and charges *before* work begins.
- `decrementQuota` is the refund path, called on insert failure and on `processSummary` failure — preserving the invariant that failed runs don't consume quota.
- Limit is `FREE_TIER_MONTHLY_LIMIT` (default 10). Over-quota returns HTTP 402.

### LLM contract (`src/lib/llm/gemini.ts` + `src/types/summary-content.ts`)

- Model: `gemini-2.5-flash` with `responseSchema` constrained JSON output.
- Two parallel schema definitions for the same shape must stay in lockstep:
  - `summaryContentSchema` (Zod, used for validation post-response)
  - `summaryContentJsonSchema` (hand-written JSON Schema, fed to Gemini)
  - Plus the `SchemaType` object inside `gemini.ts` used by the SDK's typed builder.
  - **If you change the summary shape, edit all three.**
- Error handling ladder: one primary attempt → one Zod-repair retry (the Zod error string is pasted back into the prompt) → `repairOverlongStrings` truncates `oneLineSummary`/`summary`/`cliffNotes` items to their Zod `max` as a last-resort graceful fallback. Only if that still fails does the job hard-fail.
- Transient network/5xx gets its own exponential backoff inside `callWithBackoff`.
- Cost is computed locally per request (`centsFromTokens`) and stored in `costUsdCents`.

### Templates

- 3 system templates (`src/lib/templates/system-templates.ts`) are seeded via `npm run db:seed` and have `userId: null` + `isSystem: true`. User-owned templates are Phase 2+; today only system templates exist in the UI.
- Access rule in `POST /api/summaries`: template is accessible when `template.userId == null` OR `template.userId == user.id`.
- `renderMarkdown` (`src/lib/templates/render-markdown.ts`) uses a Handlebars instance with a compile cache keyed by `templateKey`. Custom helpers: `eq`, `formatTimestamp`, `formatDate`.

### Auth & DB

- Clerk middleware protects `/app(.*)`. Anything else (including `/api/webhooks/clerk`) is public.
- `getOrCreateAppUser()` (`src/lib/auth-helpers.ts`) is the entry point everywhere. It lazily creates the DB `users` row on first request if the Clerk `user.created` webhook hasn't landed — this is deliberate so local dev works without wiring the webhook.
- The Drizzle `db` export (`src/db/index.ts`) is a Proxy that constructs the Neon HTTP client on first use. Import-time side effects are avoided so the build doesn't require `DATABASE_URL`.
- Neon HTTP driver (not the pooled Postgres driver). Transactions are single-statement multi-queries; no long-lived connections.

### Env

All env access goes through `src/lib/env.ts` (`@t3-oss/env-nextjs`). Do not read `process.env.FOO` directly in feature code — add it to the schema.

## Conventions and gotchas

- Path alias `@/*` → `src/*` (tsconfig + vitest).
- Dedup semantics in `POST /api/summaries`: existing non-failed summary returns HTTP 409 with the existing `summaryId`; existing *failed* summary is reused (same row), quota is re-charged, status reset to `pending`.
- `videos` rows are shared across users (keyed by `youtubeId`). `summaries` has a `unique(userId, videoId)` constraint that enforces dedupe at the DB layer.
- Never bypass quota checks when adding new summary-creation paths — a failed run must refund via `decrementQuota`, not leak.
- `durationSeconds > 7200` (2h) is a hard reject inside the worker; add new limits next to `MAX_DURATION_SECONDS` in `process-summary.ts`.
- Phase 2+ features deliberately not implemented: Notion sync, custom user templates UI, channel subscriptions, pgvector search. Schema tables exist (`notion_connections`, `channel_subscriptions`) but are unused.
