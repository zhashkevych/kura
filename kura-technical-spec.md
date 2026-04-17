# Kura — Technical Specification (v0.1 MVP)

> *Kura* (蔵) — a traditional Japanese storehouse used to protect valuables across generations. The app is a storehouse for knowledge extracted from YouTube.

**Audience:** Claude Code agent executing autonomously.
**App name:** `kura` (working name — verify domain and TESS availability before commit).
**Author constraint:** Solo developer, weekend MVP, ~20 hours of build time.
**North-star feature:** Paste a YouTube URL → get a structured Markdown note written into your Obsidian vault or Notion database. Everything else follows from this.

---

## 0. Execution Guidance for Claude Code

Read this spec top to bottom before writing any code. Then execute Section 10 ("Build Order") as a sequential task list. Each milestone has an explicit Definition of Done — do not proceed to the next milestone until the current one is verifiable end-to-end.

When you encounter ambiguity:
1. Prefer the simplest implementation that satisfies the spec.
2. If a design decision isn't specified and has non-trivial tradeoffs, stop and ask.
3. If a library version is specified, pin it. Do not upgrade to newer majors without asking.
4. Write TypeScript strict mode. No `any` unless justified in a comment.
5. Commit after every milestone with the milestone number in the message.

---

## 1. Scope

### 1.1 MVP (Weekend 1 — ~20 hours, must ship)

- [ ] Landing page with single CTA ("Paste a YouTube URL")
- [ ] Email/Google auth (Clerk)
- [ ] Paste URL → fetch transcript → generate structured summary → store → render
- [ ] 3 preset templates (Generic, Interview/Podcast, Lecture/Tutorial)
- [ ] Download as Markdown (.md file with YAML frontmatter, Obsidian-compatible)
- [ ] "My Library" page listing all user's processed videos
- [ ] Individual summary view page
- [ ] Basic error handling (invalid URL, no transcript available, LLM failure)

### 1.2 Phase 2 (Weekend 2 — ~15 hours)

- [ ] Notion OAuth + push-to-database
- [ ] Custom template editor (user-defined variable slots)
- [ ] Channel subscriptions (RSS polling → auto-process new uploads)
- [ ] Rate limiting per user (free tier: 10 summaries/month)

### 1.3 Explicitly Out of Scope for v1

- pgvector / cross-video semantic search (Phase 3)
- Chrome extension (Phase 4)
- Obsidian plugin (Phase 4)
- Stripe billing (ship free tier first, add paywall at 500 signups)
- Desktop sync daemon (Phase 5)
- Multi-language UI (English only at launch)
- Team/workspace accounts

Do not silently expand scope. If a feature feels like it "would be easy to add," resist unless it is in section 1.1.

---

## 2. Architecture

```
┌─────────────┐
│   Browser   │
│ (Next.js UI)│
└──────┬──────┘
       │ HTTPS
       ▼
┌──────────────────────────────────────┐
│         Next.js App Router            │
│   Vercel Edge + Serverless Functions  │
│                                       │
│   /app/(marketing)  ← public pages    │
│   /app/(app)        ← authed pages    │
│   /app/api/*        ← route handlers  │
└──────┬────────────────────────────────┘
       │
       ├──────► Clerk (auth)
       │
       ├──────► Supadata API (transcripts)
       │
       ├──────► Gemini 2.5 Flash (default LLM)
       │        Anthropic Claude Sonnet (premium toggle, v1.1)
       │
       └──────► Neon Postgres (primary store)
                 ├─ users (mirrored from Clerk)
                 ├─ videos
                 ├─ summaries
                 ├─ templates
                 └─ notion_connections (v1.1)
```

### 2.1 Processing pipeline (the core loop)

```
URL input
  │
  ▼
validate URL + extract videoId          (pure function)
  │
  ▼
check DB for existing summary for (user, videoId)   → return cached if exists
  │
  ▼
fetch metadata (title, channel, duration, publish date)   via Supadata
  │
  ▼
fetch transcript with timestamps                          via Supadata
  │
  ▼
load user's selected template                             from DB
  │
  ▼
build LLM prompt (transcript + metadata + template)
  │
  ▼
call Gemini 2.5 Flash with responseSchema
  │
  ▼
validate structured response (zod)
  │
  ▼
persist Summary row + return to client
  │
  ▼
render Markdown preview; user clicks "Download .md" or "Send to Notion"
```

Expected p50 latency for a 30-minute video: ~12s. p95: ~25s. Use Next.js streaming (`Suspense` + Server Actions) to show progress, or a simple polling endpoint. **Do not block on a single request for > 30s** — Vercel serverless functions hard-cap at 60s on Hobby, 300s on Pro. Use a background job pattern: POST `/api/summaries` returns a `summaryId` with `status=pending`; client polls `/api/summaries/:id`.

---

## 3. Tech Stack

Pin these versions. Do not upgrade without asking.

| Layer | Choice | Version | Notes |
|---|---|---|---|
| Runtime | Node.js | 20 LTS | Vercel default |
| Framework | Next.js | 15.x | App Router, Server Actions enabled |
| Language | TypeScript | 5.6+ | `strict: true` |
| Styling | Tailwind CSS | 4.x | |
| UI kit | shadcn/ui | latest | Install components as needed, not globally |
| Auth | Clerk | 6.x | `@clerk/nextjs` |
| Database | Neon Postgres | — | Serverless driver |
| ORM | Drizzle ORM | 0.36+ | `drizzle-kit` for migrations |
| Transcript API | Supadata | — | `supadata-js` SDK or plain `fetch` |
| LLM (default) | Gemini 2.5 Flash | — | `@google/generative-ai`, use `responseSchema` |
| LLM (premium, v1.1) | Anthropic Claude Sonnet 4.6 | — | `@anthropic-ai/sdk` |
| Validation | Zod | 3.23+ | |
| Date handling | date-fns | 4.x | |
| Deployment | Vercel | — | Hobby tier is fine for MVP |
| Analytics | Plausible or PostHog | — | Self-host Plausible later; PostHog free tier for MVP |

**Explicitly rejected for MVP:**
- yt-dlp / youtube-transcript-api on the server (unreliable from datacenter IPs since mid-2025 — YouTube's SABR rollout blocks cloud scrapers). Use Supadata. If Supadata goes down, document the fallback but don't build it now.
- Prisma (slower cold starts than Drizzle on Vercel).
- Redis / BullMQ (overkill for MVP; use Postgres + simple status column for job tracking).
- tRPC (Server Actions + route handlers are sufficient).

---

## 4. Data Model

### 4.1 Drizzle schema (`/src/db/schema.ts`)

```typescript
import { pgTable, uuid, text, timestamp, integer, jsonb, boolean, unique, index } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // usage tracking for free tier
  monthlyUsageCount: integer('monthly_usage_count').notNull().default(0),
  monthlyUsageResetAt: timestamp('monthly_usage_reset_at').notNull().defaultNow(),
});

export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  youtubeId: text('youtube_id').notNull().unique(),  // 11-char YouTube ID
  title: text('title').notNull(),
  channelName: text('channel_name').notNull(),
  channelId: text('channel_id'),
  durationSeconds: integer('duration_seconds'),
  publishedAt: timestamp('published_at'),
  thumbnailUrl: text('thumbnail_url'),
  transcriptText: text('transcript_text'),       // full transcript, for re-processing
  transcriptSegments: jsonb('transcript_segments'), // [{start, end, text}]
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const summaries = pgTable('summaries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  videoId: uuid('video_id').notNull().references(() => videos.id),
  templateId: uuid('template_id').references(() => templates.id),
  status: text('status', { enum: ['pending', 'processing', 'ready', 'failed'] }).notNull().default('pending'),
  errorMessage: text('error_message'),
  content: jsonb('content'),  // structured output; see section 11.2
  modelUsed: text('model_used'),
  tokensInput: integer('tokens_input'),
  tokensOutput: integer('tokens_output'),
  costUsdCents: integer('cost_usd_cents'),  // store as integer cents
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({
  userVideoUnique: unique().on(t.userId, t.videoId),  // one summary per (user, video)
  userCreatedIdx: index('summaries_user_created_idx').on(t.userId, t.createdAt),
}));

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),  // null = system preset
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  promptTemplate: text('prompt_template').notNull(),  // see section 11.1
  outputSchema: jsonb('output_schema').notNull(),      // JSON schema for structured output
  markdownTemplate: text('markdown_template').notNull(), // Handlebars-style, see section 11.3
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// v1.1 additions — stub the tables now, implement later
export const notionConnections = pgTable('notion_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  accessToken: text('access_token').notNull(),  // encrypt at rest; see section 8
  workspaceId: text('workspace_id').notNull(),
  workspaceName: text('workspace_name'),
  defaultDatabaseId: text('default_database_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const channelSubscriptions = pgTable('channel_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  youtubeChannelId: text('youtube_channel_id').notNull(),
  channelName: text('channel_name').notNull(),
  templateId: uuid('template_id').references(() => templates.id),
  lastCheckedAt: timestamp('last_checked_at'),
  lastProcessedVideoId: text('last_processed_video_id'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  userChannelUnique: unique().on(t.userId, t.youtubeChannelId),
}));
```

### 4.2 Seed data

On first migration, seed 3 system templates (Generic, Interview/Podcast, Lecture/Tutorial). See Appendix A for their exact content.

---

## 5. API Contracts

All endpoints are Next.js route handlers under `/src/app/api/`. All authenticated endpoints require Clerk session; return 401 if absent.

### 5.1 `POST /api/summaries`

Creates a new summary job. Returns immediately with a job ID; actual processing happens in the background (see section 7.1 for pattern).

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "templateId": "uuid-of-template"
}
```

**Response 200:**
```json
{
  "summaryId": "uuid",
  "status": "pending"
}
```

**Errors:**
- `400` — invalid URL or unparseable video ID
- `401` — not authenticated
- `402` — monthly quota exceeded (free tier)
- `404` — template not found or not owned
- `409` — user already has a summary for this video (return existing `summaryId` in body)
- `422` — transcript not available for this video (private, live, no captions)

### 5.2 `GET /api/summaries/:id`

Returns current state of a summary. Used for polling.

**Response 200:**
```json
{
  "id": "uuid",
  "status": "pending" | "processing" | "ready" | "failed",
  "video": { "id, title, channelName, durationSeconds, thumbnailUrl, publishedAt, youtubeId" },
  "content": { /* structured output, null until status=ready */ },
  "errorMessage": "string | null",
  "createdAt": "ISO 8601"
}
```

### 5.3 `GET /api/summaries`

Lists the authenticated user's summaries. Paginated.

Query params: `?limit=20&cursor=<createdAt-iso>`.

### 5.4 `DELETE /api/summaries/:id`

Deletes a summary. Cascades no further — the underlying `videos` row is shared and retained.

### 5.5 `GET /api/summaries/:id/markdown`

Returns `text/markdown; charset=utf-8` with `Content-Disposition: attachment; filename="{slug}.md"`. Applies the template's `markdownTemplate` to the structured content.

### 5.6 `GET /api/templates`

Lists system templates (always visible) + user's custom templates.

### 5.7 `POST /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`

Standard CRUD for user templates. System templates (`isSystem=true`) are read-only.

### 5.8 `POST /api/webhooks/clerk`

Clerk webhook receiver. Handles `user.created` → insert into `users`; `user.deleted` → cascade delete.

---

## 6. Frontend Routes & Components

### 6.1 Routes

```
/                          → Marketing landing page (public)
/sign-in                   → Clerk-hosted sign-in
/sign-up                   → Clerk-hosted sign-up
/app                       → Library (authed, default page after sign-in)
/app/new                   → Paste URL form
/app/summaries/[id]        → Summary detail view
/app/templates             → Template list + editor
/app/settings              → Account settings, usage counter, Notion connection (v1.1)
```

### 6.2 Key components

- `<URLInputForm />` — the central input. Validates URL client-side (regex), posts to `/api/summaries`, redirects to `/app/summaries/[id]`.
- `<SummaryViewer />` — renders the structured content as Markdown preview. Uses `react-markdown` + `remark-gfm`.
- `<ProcessingIndicator />` — polls `/api/summaries/:id` every 2s while `status !== 'ready' && status !== 'failed'`. Shows stage: "Fetching transcript..." → "Generating summary..." → "Done".
- `<DownloadButton />` — triggers GET `/api/summaries/:id/markdown`.
- `<LibraryList />` — infinite scroll of user's summaries. Server component; client component for pagination.
- `<TemplatePicker />` — dropdown on the URL input form. Shows all accessible templates.
- `<TemplateEditor />` — textarea for prompt + JSON editor for schema + textarea for markdown template. Validate on save.

### 6.3 Design principles

- Single-column, max-width `720px` content area. Readwise-like density.
- Lean on shadcn/ui defaults. Do not over-design — the product is about the generated notes, not the chrome.
- Mobile-responsive but not mobile-optimized (this is a desktop productivity tool).
- Keyboard-first: `cmd+k` opens URL input from anywhere.

---

## 7. Core Workflows

### 7.1 URL → Summary pipeline (the background job)

Since Vercel serverless functions can time out, split the work:

```typescript
// /src/app/api/summaries/route.ts
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const { url, templateId } = await req.json();
  const videoId = extractYoutubeId(url);
  if (!videoId) return new Response('Invalid URL', { status: 400 });

  // check quota
  // check dedupe (same user + same video)
  // insert videos row if missing (transcript fetched in worker)
  // insert summaries row with status='pending'
  // trigger background processing (see below)

  return Response.json({ summaryId, status: 'pending' });
}
```

**Background execution options, in preference order:**

1. **Next.js `after()` API** (preferred, Next 15.1+). Returns the HTTP response immediately, continues work after. No external infra. ~60s max execution, enough for MVP.
2. **Vercel Cron + `processing` status poll**. Cron runs every minute, picks up `pending` rows, processes them. Adds up to 60s of latency.
3. **Inngest / Trigger.dev / QStash** — add later if `after()` proves insufficient.

**Use option 1 for MVP.** If a video is > 2 hours, reject it with a friendly message ("Videos longer than 2 hours not supported yet") rather than try to handle it.

### 7.2 The worker function

```typescript
// /src/lib/worker/process-summary.ts
export async function processSummary(summaryId: string) {
  // 1. Load summary, video, template, user
  // 2. Update status to 'processing'
  // 3. If video.transcriptText is null, fetch from Supadata
  // 4. Build prompt from template.promptTemplate + transcript
  // 5. Call Gemini with responseSchema = template.outputSchema
  // 6. Validate response with Zod (derive from outputSchema)
  // 7. Update summary: status='ready', content=response, tokensInput/Output, costUsdCents
  // 8. On any error: status='failed', errorMessage=human-readable
}
```

Wrap each external call with a 2-retry exponential backoff. Log errors to stderr (Vercel captures these). Return early on transcript-unavailable without spending LLM budget.

### 7.3 Markdown export

The template's `markdownTemplate` is a string with `{{mustache}}` placeholders matching the structured content shape. Render with Handlebars or a minimal custom function. Include YAML frontmatter so Obsidian can index it:

```markdown
---
title: "{{video.title}}"
channel: "{{video.channelName}}"
url: "https://www.youtube.com/watch?v={{video.youtubeId}}"
published: {{video.publishedAt}}
duration_minutes: {{video.durationMinutes}}
tags: [{{#each content.tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}]
processed: {{summary.createdAt}}
---

# {{video.title}}

> {{content.oneLineSummary}}

## Cliff Notes
{{content.cliffNotes}}

## Summary
{{content.summary}}

## Key Quotes
{{#each content.keyQuotes}}
- "{{quote}}" — [{{timestampLabel}}](https://www.youtube.com/watch?v={{../video.youtubeId}}&t={{startSeconds}}s)
{{/each}}

## Further Reading
{{#each content.furtherReading}}
- {{title}}{{#if author}} — {{author}}{{/if}}{{#if link}} — [link]({{link}}){{/if}}
{{/each}}
```

### 7.4 Notion sync (Phase 2)

- OAuth via `@notionhq/client`. Store token encrypted (see section 8).
- User picks a target database once in settings.
- "Send to Notion" button calls `/api/summaries/:id/send-to-notion`.
- Chunk the markdown into Notion blocks (respect 2000-char rich-text limit and 100-block append limit).
- Store the resulting Notion page ID on the summary row for future updates.

---

## 8. Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://...neon.tech/...

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Transcripts
SUPADATA_API_KEY=...

# LLMs
GOOGLE_GENERATIVE_AI_API_KEY=...
ANTHROPIC_API_KEY=...  # v1.1, premium toggle

# Notion (v1.1)
NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
NOTION_REDIRECT_URI=http://localhost:3000/api/notion/callback

# Encryption for stored OAuth tokens (v1.1)
ENCRYPTION_KEY=  # 32-byte base64, generate with: openssl rand -base64 32

# Rate limiting
FREE_TIER_MONTHLY_LIMIT=10
```

Use `@t3-oss/env-nextjs` with Zod for runtime validation. Crash on missing vars at boot.

---

## 9. Project Structure

```
kura/
├── src/
│   ├── app/
│   │   ├── (marketing)/
│   │   │   ├── page.tsx                 # landing
│   │   │   └── layout.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx               # authed shell, sidebar
│   │   │   ├── page.tsx                 # redirects to /app
│   │   │   ├── app/
│   │   │   │   ├── page.tsx             # library
│   │   │   │   ├── new/page.tsx         # URL input
│   │   │   │   ├── summaries/[id]/page.tsx
│   │   │   │   ├── templates/page.tsx
│   │   │   │   └── settings/page.tsx
│   │   ├── api/
│   │   │   ├── summaries/
│   │   │   │   ├── route.ts             # POST, GET list
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts         # GET, DELETE
│   │   │   │       └── markdown/route.ts
│   │   │   ├── templates/
│   │   │   ├── webhooks/clerk/route.ts
│   │   │   └── health/route.ts
│   │   ├── layout.tsx                   # root, ClerkProvider
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                          # shadcn
│   │   ├── url-input-form.tsx
│   │   ├── summary-viewer.tsx
│   │   ├── library-list.tsx
│   │   └── ...
│   ├── lib/
│   │   ├── env.ts                       # Zod-validated env
│   │   ├── youtube.ts                   # URL parsing, video ID extraction
│   │   ├── supadata.ts                  # transcript fetch wrapper
│   │   ├── llm/
│   │   │   ├── gemini.ts
│   │   │   ├── anthropic.ts             # v1.1
│   │   │   └── prompts.ts
│   │   ├── templates/
│   │   │   ├── system-templates.ts      # seed data, see Appendix A
│   │   │   └── render-markdown.ts
│   │   ├── worker/
│   │   │   └── process-summary.ts
│   │   └── quota.ts
│   ├── db/
│   │   ├── schema.ts
│   │   ├── index.ts                     # drizzle client
│   │   └── migrations/                  # drizzle-kit output
│   └── types/
│       └── summary-content.ts           # TypeScript types + Zod schemas
├── drizzle.config.ts
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── .env.example
├── .env.local                           # gitignored
└── README.md
```

---

## 10. Build Order (Task List)

Execute sequentially. Each milestone has a Definition of Done (DoD) that must be verifiable before moving on.

### Milestone 1 — Project skeleton (1h)

- Initialize Next.js 15 App Router with TypeScript strict, Tailwind 4, shadcn/ui.
- Set up `@t3-oss/env-nextjs` with Zod.
- Install Drizzle + Neon serverless driver.
- Create `/api/health` returning `{status: 'ok', db: 'connected'}`.
- Commit: "feat(m1): project skeleton".

**DoD:** `curl localhost:3000/api/health` returns 200 with both status fields true.

### Milestone 2 — Auth (1.5h)

- Install `@clerk/nextjs`, wire `ClerkProvider` in root layout.
- Set up `/sign-in` and `/sign-up` routes.
- Create `middleware.ts` protecting `/app/*`.
- Build `/api/webhooks/clerk` handling `user.created` → upsert into `users` table.
- Commit: "feat(m2): clerk auth".

**DoD:** Can sign up, get redirected to `/app`, see session in a server component. `users` row exists with `clerkId`.

### Milestone 3 — Database schema (1h)

- Write `schema.ts` per section 4.1.
- Generate and run initial migration with `drizzle-kit`.
- Seed 3 system templates (see Appendix A).
- Commit: "feat(m3): db schema and seed".

**DoD:** `SELECT * FROM templates WHERE is_system = true` returns 3 rows in Neon.

### Milestone 4 — YouTube URL parsing + transcript fetch (2h)

- `src/lib/youtube.ts`: export `extractYoutubeId(url)` handling all common URL formats (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`). Return `null` for invalid.
- `src/lib/supadata.ts`: wrap Supadata's transcript + metadata endpoints. Return typed `{ title, channelName, channelId, durationSeconds, publishedAt, thumbnailUrl, segments: [{start, end, text}] }`.
- Handle error cases: no captions, private, age-restricted, live. Map to typed error codes.
- Write unit tests for URL parsing (12+ cases).
- Commit: "feat(m4): youtube + supadata integration".

**DoD:** A test script `node scripts/test-transcript.ts <URL>` prints metadata and first 200 chars of transcript. Works for at least 3 diverse videos (talking-head, podcast, lecture).

### Milestone 5 — LLM integration (2.5h)

- `src/lib/llm/gemini.ts`: export `generateSummary({ transcript, metadata, template })`. Use `@google/generative-ai` with `responseSchema` set from `template.outputSchema`. Return parsed + Zod-validated structured content.
- Build the default prompt template (see section 11.1).
- Write the default output Zod schema (see section 11.2).
- Track token usage and compute cost in cents.
- Commit: "feat(m5): gemini integration".

**DoD:** Test script produces a valid structured summary for a 10-minute talking-head video. Output conforms to Zod schema without manual fixing.

### Milestone 6 — The main POST `/api/summaries` pipeline (3h)

- Implement POST per section 5.1, including quota check and dedupe.
- Implement GET `/api/summaries/:id` for polling.
- Use `after()` to process in the background.
- Implement the worker function per section 7.2 with retries and proper error states.
- Commit: "feat(m6): summary pipeline".

**DoD:** End-to-end curl test: POST a URL, poll until `status=ready`, inspect the content. All fields populated correctly. Quota increments.

### Milestone 7 — Frontend: URL input + summary view + library (4h)

- `/app/new`: URL input form with template picker. On submit, POST and redirect to `/app/summaries/[id]`.
- `/app/summaries/[id]`: polls until ready, then renders `<SummaryViewer />`. Show video thumbnail, title, channel, duration.
- `/app`: library list, most recent first, shows 20, infinite scroll.
- `<DownloadButton />` → hits markdown route.
- Basic error UI for the three main failure modes (invalid URL, no transcript, LLM failure).
- Commit: "feat(m7): core UI".

**DoD:** Manual end-to-end test: sign in → paste URL → see processing → see rendered summary → download .md → open in Obsidian and verify YAML frontmatter + body render correctly.

### Milestone 8 — Markdown export (1.5h)

- `src/lib/templates/render-markdown.ts`: Handlebars-style render of `markdownTemplate` against structured content + video metadata.
- GET `/api/summaries/:id/markdown` returns the rendered file with correct headers.
- Test with all 3 system templates.
- Commit: "feat(m8): markdown export".

**DoD:** Downloaded .md files for each of the 3 templates open cleanly in Obsidian and Notion (via paste).

### Milestone 9 — Polish + deploy (2h)

- Marketing landing page: headline, 30-second GIF/Loom of the flow, "Try free" CTA.
- Settings page: show usage counter (`X / 10 this month`).
- Friendly empty states.
- Deploy to Vercel. Configure all env vars. Wire Clerk webhook to production URL.
- Set up custom domain (if purchased).
- Commit: "feat(m9): polish + deploy".

**DoD:** Production URL processes a real video end-to-end for a fresh signup.

### Milestone 10 — Buffer (1.5h)

Reserved for bug fixes, copy tweaks, and the small thing that always breaks during deploy.

---

**Total: ~20 hours.** This is the weekend MVP. After this ships, begin Phase 2 (section 1.2).

---

## 11. Prompt Engineering

### 11.1 Default prompt template (Generic)

```
You are an expert note-taker building a personal knowledge base. Extract the essential content from this YouTube video transcript.

# Video metadata
Title: {{title}}
Channel: {{channelName}}
Duration: {{durationMinutes}} minutes
Published: {{publishedDate}}

# Transcript (with timestamps)
{{transcript}}

# Instructions
Produce a structured note with the following fields:

1. **oneLineSummary**: A single sentence capturing the core thesis or takeaway.
2. **cliffNotes**: 5–10 bullet points capturing the most important claims, findings, or ideas. Each bullet should be a complete thought, not a fragment. Write as if for your future self re-reading in 6 months.
3. **summary**: A 2–4 paragraph prose summary. Flowing, readable, no filler. Preserve the speaker's reasoning chain.
4. **keyQuotes**: 3–7 verbatim quotes that are genuinely insightful, memorable, or represent the core argument. For each, include the startSeconds from the transcript and a human-readable timestampLabel (e.g., "12:34"). Skip filler quotes like "that's a great question."
5. **furtherReading**: Every book, paper, person, tool, or concept mentioned that would be worth following up on. Include author/creator when stated. Include links only if they appear in the transcript.
6. **tags**: 3–6 lowercase kebab-case topical tags for a PKM system (e.g., "macroeconomics", "cognitive-science", "startup-advice"). Prefer specific over generic.

Be rigorous about accuracy: do not paraphrase quotes, do not invent citations, do not smooth over contradictions in the speaker's argument.
```

### 11.2 Default output Zod schema

```typescript
// src/types/summary-content.ts
import { z } from 'zod';

export const summaryContentSchema = z.object({
  oneLineSummary: z.string().min(10).max(300),
  cliffNotes: z.array(z.string().min(5)).min(3).max(12),
  summary: z.string().min(100).max(4000),
  keyQuotes: z.array(z.object({
    quote: z.string().min(10),
    startSeconds: z.number().int().nonnegative(),
    timestampLabel: z.string(),  // "MM:SS" or "HH:MM:SS"
  })).min(1).max(10),
  furtherReading: z.array(z.object({
    title: z.string(),
    author: z.string().optional(),
    type: z.enum(['book', 'paper', 'person', 'tool', 'concept', 'other']).optional(),
    link: z.string().url().optional(),
    context: z.string().optional(),  // one-sentence "why this was mentioned"
  })).max(25),
  tags: z.array(z.string().regex(/^[a-z0-9-]+$/)).min(2).max(8),
});

export type SummaryContent = z.infer<typeof summaryContentSchema>;
```

Convert this Zod schema to a Gemini `responseSchema` at runtime (or hand-write the JSON schema and validate with Zod on return — simpler and more robust for MVP).

### 11.3 Template system notes

- System templates (Generic, Interview, Lecture) share the same output schema but differ in their prompt wording and markdown rendering.
- Users (v1.1) can create custom templates by editing the prompt + markdown template. For MVP, schema is fixed.
- Interview template adds instructions to separate speakers if identifiable.
- Lecture template emphasizes structured outline over key quotes.

See Appendix A for full text of all three system templates.

---

## 12. Testing

**Scope for MVP: pragmatic, not exhaustive.**

- **Unit tests (Vitest):**
  - `extractYoutubeId` — 12+ URL variants + invalid cases
  - `renderMarkdown` — each of 3 system templates against a fixture `SummaryContent`
  - Quota logic (reset at month boundary)
- **Integration tests:** one end-to-end test hitting Supadata and Gemini with a known short public video. Skip if `CI=true` to avoid API costs on every push.
- **Manual QA checklist** (run before deploy):
  - Sign up → paste URL → verify processing → download .md → open in Obsidian
  - Paste invalid URL → friendly error
  - Paste video with no captions → friendly error (not a 500)
  - Hit quota → 402 with clear message
  - Dedupe: paste same URL twice → get same summary, quota doesn't increment second time

Do not write React component tests for the MVP. Time budget doesn't justify it.

---

## 13. Deployment

### 13.1 Neon Postgres

- Create project in Neon console.
- Use the pooled connection string for `DATABASE_URL`.
- Run `drizzle-kit migrate` locally against production URL for initial setup.

### 13.2 Vercel

- Connect GitHub repo.
- Set all env vars from section 8.
- `next.config.ts`: no special config needed for MVP.
- Set Node.js version to 20.
- Enable "Fluid Compute" for longer background execution via `after()`.

### 13.3 Clerk

- Create production instance.
- Configure redirect URLs to production domain.
- Register webhook pointing to `https://yourdomain.com/api/webhooks/clerk`.

### 13.4 Supadata / Gemini

- Start on free tiers.
- Watch logs for 429 rate limits in the first week; upgrade if hit.

---

## 14. Definition of Done — MVP

The MVP is shipped when all of the following are true:

1. A new user can sign up, paste a YouTube URL, and receive a structured Markdown summary they can download, in under 30 seconds for a typical 20-minute video.
2. The downloaded `.md` file opens in Obsidian with valid YAML frontmatter and renders correctly.
3. The library page shows all of that user's past summaries, sorted by most recent.
4. Free tier quota enforces at 10 summaries/month with a clear error message when hit.
5. All three failure modes (invalid URL, no transcript, LLM error) produce human-readable error states, not 500s.
6. The production URL is live, with a domain, and at least one friend/colleague has successfully used it end-to-end.
7. Vercel logs show no uncaught exceptions during a 24-hour window of normal usage.

Anything beyond this is Phase 2 or later.

---

## Appendix A — System Templates (Seed Data)

Three templates to seed on first migration. Each has `isSystem=true`, `userId=null`.

### Generic (default)

- **name**: "General Knowledge Capture"
- **description**: "Balanced summary with cliff notes, quotes, and further reading. Good default for most videos."
- **promptTemplate**: See section 11.1.
- **outputSchema**: See section 11.2 (converted to JSON Schema).
- **markdownTemplate**: See section 7.3.

### Interview / Podcast

- **name**: "Interview / Podcast"
- **description**: "Optimized for conversations between 2+ people. Extracts positions per speaker."
- **promptTemplate**: Modify generic to add: *"This is a conversation between multiple people. In your cliff notes and key quotes, attribute claims to the specific speaker when possible (by name if stated, otherwise 'Host' / 'Guest')."*
- **markdownTemplate**: Same structure but prefaces cliffNotes with "Key points (with speaker attribution)".

### Lecture / Tutorial

- **name**: "Lecture / Tutorial"
- **description**: "Optimized for structured educational content. Emphasizes outline over quotes."
- **promptTemplate**: Modify generic to add: *"This is structured educational content. Prioritize capturing the conceptual outline and the logical flow of ideas over memorable quotes. cliffNotes should read like a table of contents a student could use to rebuild the lecture from memory."*
- **markdownTemplate**: Same structure but cliffNotes section is titled "Lecture Outline" and keyQuotes is titled "Notable Claims".

---

## Appendix B — Known Pitfalls (read before coding)

1. **Supadata rate limits.** Free tier is ~100 videos/month. Development will eat into this quickly. Mock the transcript fetch in tests. Cache aggressively (the `videos` table dedupes across all users).

2. **Gemini `responseSchema` quirks.** Gemini sometimes returns valid JSON that doesn't perfectly match the schema (e.g., missing optional fields). Always parse with Zod and have a retry path that re-prompts with the specific error message.

3. **Notion block limits (Phase 2).** A single API call can append max 100 blocks; a rich_text block max 2000 chars. Long summaries must be chunked. Use a known library helper or test with a 10k-word transcript before shipping.

4. **Vercel function timeout.** 60s on Hobby tier. A 2-hour video transcript can push Gemini inference close to this limit. Either use `after()`, upgrade to Pro (300s), or reject videos > 2 hours. Recommend: reject > 2 hours in MVP.

5. **Clerk webhook signature verification.** Do not skip it. Use `@clerk/nextjs/webhooks` helper.

6. **Next.js 15 `after()` caveats.** Work in `after()` does not share the request's session. If you need `userId` inside, capture it from auth() *before* calling `after()` and pass it in.

7. **YouTube URL formats.** Test against: `watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `v/`, URLs with `&t=123s`, URLs with `&list=...`, URLs with `?si=...` tracking params. Strip tracking params before storing.

8. **Timestamp math.** Supadata segments are in seconds (floats). YouTube URL `&t=` param takes integer seconds. Convert carefully and test the generated links actually jump to the right moment.

9. **Encryption for stored OAuth tokens (Phase 2).** Use Node's `crypto.subtle` with AES-GCM. Do not store tokens in plaintext in Postgres even for MVP's single-user Notion integration.

10. **The "first 10 videos are weirdly bad" problem.** Gemini outputs are non-deterministic. Generate 3 summaries for the same video during dev and compare. Tune the prompt until consistency is high. Budget a full hour for prompt iteration before calling M5 done.

---

## Appendix C — Post-MVP Roadmap (for context, do not build yet)

**Phase 2 (Weekend 2):** Notion sync, custom templates, channel subscriptions, basic rate limiting.

**Phase 3 (Month 2):** pgvector cross-video semantic search with timestamp citations. Stripe billing. Annual plans. Lifetime license.

**Phase 4 (Month 3–4):** Chrome extension for one-click capture while watching. Obsidian community plugin.

**Phase 5 (Month 5+):** Desktop helper for auto-writing to watched vault folders. Open-source self-host guide. CLI for power users.

Keep these in mind during MVP design — the `videos.transcriptText` column, the templates-as-data pattern, and the structured JSON content payload all exist specifically so Phase 2–5 can layer on without rewrites.
