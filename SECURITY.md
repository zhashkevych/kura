# Security policy

## Reporting a vulnerability

If you've found a security issue in Kura, please **do not** file a public
GitHub issue. Instead, report it privately via one of:

- [GitHub Security Advisory](https://github.com/zhashkevych/kura/security/advisories/new)
  (preferred)
- Email: maksym@joinmassive.com

Please include:

- A description of the issue and its impact
- Steps to reproduce, or a proof of concept
- Any relevant logs, payloads, or affected versions

## What's in scope

- The code in this repository
- The hosted instance at https://kura-md.com

## What's out of scope

- Vulnerabilities in third-party services Kura depends on (Clerk, Neon,
  Supadata, Google AI Studio, Vercel) — please report those upstream.
- Issues that require a compromised Clerk account or stolen API keys to
  exploit.

## Response

I'll acknowledge reports within 72 hours and aim to ship a fix or mitigation
within 14 days for high-severity issues. Researchers acting in good faith will
be credited in the release notes for the fix unless you'd prefer to remain
anonymous.
