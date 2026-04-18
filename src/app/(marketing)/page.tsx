import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <h1 className="text-5xl font-semibold tracking-tight">
        Turn YouTube into notes you&apos;ll actually re-read.
      </h1>
      <p className="mt-6 text-lg text-[var(--muted-foreground)]">
        Paste a URL. Get a structured Markdown file — cliff notes, quotes with timestamps, and
        further reading — dropped straight into your Obsidian vault or Notion database.
      </p>

      <div className="mt-8 flex gap-3">
        <Link
          href="/sign-up"
          className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-5 py-2.5 font-medium"
        >
          Try it free
        </Link>
      </div>

      <section className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Feature
          title="Writes to your vault, not another silo"
          body="A .md file with YAML frontmatter. Drop it in Obsidian, Notion, Logseq, or any folder of Markdown. No lock-in. Your notes live in your filesystem, indexed by the tool you already trust."
        />
        <Feature
          title="Timestamped quotes link back to YouTube"
          body="Every quoted passage in the summary includes a clickable timestamp. One click takes you back to the exact moment in the video — verify a claim, re-listen, or dig deeper."
        />
        <Feature
          title="Open-source core, bring your own key"
          body="The CLI, self-host backend, and Obsidian plugin are on GitHub. Run it yourself with a Gemini or Claude API key. Or skip the setup and use the hosted tier for $9.99/mo."
        />
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-[var(--muted-foreground)]">{body}</p>
    </div>
  );
}
