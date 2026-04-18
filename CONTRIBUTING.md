# Contributing to Kura

Thanks for your interest in contributing! Kura is a small, focused project — a
YouTube-to-Markdown pipeline for note-taking. Contributions of all sizes are
welcome.

## Getting set up

Follow the [Self-host](./README.md#self-host) section of the README to get a
working local environment. The short version:

```bash
npm install
cp .env.example .env.local      # fill in the four required services
npm run db:push && npm run db:seed
npm run dev
```

## The change → PR loop

Before opening a pull request, make sure all three of these pass:

```bash
npm run typecheck
npm test
npm run build
```

CI runs the same gates on every PR.

## Commit style

This repo uses [Conventional Commits](https://www.conventionalcommits.org/)
loosely — see `git log` for examples. Common prefixes:

- `feat:` — user-visible new behavior
- `fix:` — bug fix
- `refactor:` — code change with no behavior change
- `docs:` — documentation only
- `chore:` — tooling, deps, housekeeping

Scopes are optional but used (`feat(app): …`, `fix(llm): …`).

## Architecture orientation

[`CLAUDE.md`](./CLAUDE.md) is the single source of truth for the architecture:
request flow, quota invariants, the LLM contract, the schema-triplet that must
stay in lockstep, and the gotchas. Read it before making non-trivial changes.
It's named for Claude Code but it's the right onboarding doc for any
contributor.

## Scope and non-goals

Kura is intentionally small. The following are **out of scope** for the open
source repo today:

- Notion sync (schema exists, integration does not)
- User-owned custom templates UI (system templates only for now)
- YouTube channel subscriptions / auto-ingest
- pgvector / semantic search across notes
- Billing, paid tiers, team features

If you want to work on one of these, please open an issue first to discuss
direction before writing code.

## What makes a good PR

- One logical change per PR. If you find adjacent issues, file them separately.
- Tests for new logic where it makes sense (look at `src/lib/youtube.test.ts`
  for the style — small, fast, no network).
- Don't add backwards-compatibility shims for code that hasn't shipped yet.
- Don't introduce abstractions ahead of a second concrete use case.
- Keep dependencies lean — adding a package needs a one-line justification in
  the PR.

## Reporting bugs

Open a [GitHub issue](https://github.com/zhashkevych/kura/issues) with:

- What you did
- What you expected
- What happened
- Logs or a stack trace, if you have them

For security issues, see [SECURITY.md](./SECURITY.md) instead — please don't
file a public issue.
