import Link from 'next/link';

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
        <Link
          href="/sign-in"
          className="rounded-md border border-[var(--border)] px-5 py-2.5 font-medium"
        >
          Sign in
        </Link>
      </div>

      <section className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Feature
          title="Structured output"
          body="Every summary has the same shape: one-line takeaway, cliff notes, quotes, further reading, tags."
        />
        <Feature
          title="Obsidian-ready"
          body="Download a .md file with YAML frontmatter. Drop it in your vault and it's indexed."
        />
        <Feature
          title="Three templates"
          body="Generic, Interview, Lecture. Each tuned for a different kind of video."
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
