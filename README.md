# Kura

> 蔵 — a traditional Japanese storehouse. Kura is a storehouse for knowledge extracted from YouTube.

Paste a YouTube URL → get a structured Markdown note for your Obsidian vault or Notion database.

## Stack

- Next.js 15 (App Router, Server Actions, `after()`)
- TypeScript strict
- Tailwind 4 + shadcn-style primitives
- Clerk for auth
- Neon Postgres + Drizzle ORM
- Supadata for transcripts
- Gemini 2.5 Flash for structured output
- Handlebars for Markdown templates

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Provision external services**

   - [Neon](https://neon.tech) — create a project, copy the pooled connection string.
   - [Clerk](https://clerk.com) — create an application, grab the publishable + secret keys.
     Create a webhook pointing at `https://<your-domain>/api/webhooks/clerk` listening for
     `user.created`, `user.updated`, `user.deleted`. Copy the signing secret.
   - [Supadata](https://supadata.ai) — API key.
   - [Google AI Studio](https://aistudio.google.com) — API key for Gemini.

3. **Configure environment**

   ```bash
   cp .env.example .env.local
   # fill in every required value
   ```

4. **Run migrations + seed**

   ```bash
   npm run db:push      # applies the Drizzle schema to Neon
   npm run db:seed      # inserts the 3 system templates
   ```

5. **Dev server**

   ```bash
   npm run dev
   ```

   Visit http://localhost:3000.

## Smoke tests

With a live `.env.local`:

```bash
# verify DB connectivity
curl -s localhost:3000/api/health | jq

# fetch a transcript without touching the DB or LLM
npx tsx scripts/test-transcript.ts "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# end-to-end pipeline to the LLM (costs a few tokens)
npx tsx scripts/test-summary.ts "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

## Manual QA checklist

Before shipping to prod, verify:

- [ ] Sign up → paste URL → summary completes → download `.md` → opens cleanly in Obsidian.
- [ ] Paste an invalid URL → friendly error (not a 500).
- [ ] Paste a video with no captions → friendly error.
- [ ] Paste the same URL twice → second POST returns the same `summaryId` and does not increment quota.
- [ ] Hit the monthly quota (default: 10) → `402` response with a clear message.
- [ ] Vercel logs show no uncaught exceptions after 24h of normal usage.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Set every variable from `.env.example` in the project settings.
3. Ensure "Fluid Compute" is enabled so `after()` background work has time to finish.
4. Point your Clerk webhook at the production URL.
5. Run `npm run db:push && npm run db:seed` from your workstation against the production
   `DATABASE_URL` once on first deploy.

## Testing

```bash
npm run typecheck
npm test
npm run build
```

## Scope

This is the MVP described in `kura-technical-spec.md`. Notion sync, custom templates, channel
subscriptions, and pgvector search are explicitly Phase 2+.
