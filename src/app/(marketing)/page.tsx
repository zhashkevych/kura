import Link from 'next/link';
import { PricingSection } from '@/components/pricing-section';

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <main>
      <section className="mx-auto max-w-3xl px-6 py-20">
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

        <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-6">
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
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">From fifteen minutes to thirty seconds</h2>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          <Workflow
            label="Manual workflow"
            steps={[
              'Open YouTube, enable captions.',
              'Copy the transcript from the CC panel.',
              'Paste into ChatGPT, write a prompt.',
              'Review, fix errors, trim irrelevant sections.',
              'Copy output into your vault.',
              'Add frontmatter, tags, source URL by hand.',
              'Link back to video timestamps manually.',
            ]}
            total="~15 min"
          />
          <Workflow
            label="With Kura"
            steps={['Paste URL.', 'Pick a template.', 'Download or sync.']}
            total="~30 sec"
          />
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Open-source core</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="https://github.com/zhashkevych/kura"
            className="inline-block"
            aria-label="Kura GitHub stars"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/stars/zhashkevych/kura?style=flat-square&label=Stars"
              alt="GitHub stars"
              loading="lazy"
              height={20}
            />
          </a>
          <a
            href="https://github.com/zhashkevych/kura/blob/main/LICENSE"
            className="inline-block"
            aria-label="Kura license"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://img.shields.io/github/license/zhashkevych/kura?style=flat-square"
              alt="License"
              loading="lazy"
              height={20}
            />
          </a>
        </div>
        <p className="mt-6 text-[var(--muted-foreground)]">
          The transcript pipeline, Markdown renderer, Obsidian plugin, and self-host backend are
          on GitHub. Run the whole thing on your own hardware with your own Gemini or Claude API
          key. Use the hosted tier if you&apos;d rather not. Both paths produce the same Markdown.
        </p>
        <div className="mt-6 flex flex-wrap gap-6 text-sm">
          <a
            href="https://github.com/zhashkevych/kura"
            className="font-medium underline-offset-4 hover:underline"
          >
            View on GitHub →
          </a>
          <a
            href="https://github.com/zhashkevych/kura#self-host"
            className="text-[var(--muted-foreground)] underline-offset-4 hover:underline"
          >
            Self-host guide →
          </a>
        </div>
      </section>

      <PricingSection />

      <section className="mx-auto max-w-3xl px-6 py-20">
        <h2 className="text-3xl font-semibold tracking-tight">Frequently asked</h2>
        <div className="mt-10">
          <FaqItem question="Does this work with my existing Obsidian vault structure?">
            Yes. Kura produces a standard <code>.md</code> file with YAML frontmatter — the same
            format Obsidian uses natively. Drop it in any folder, use any existing tag taxonomy,
            keep your current templater setup. Kura does not assume anything about your vault
            layout.
          </FaqItem>
          <FaqItem question="Can I self-host? What about yt-dlp?">
            Yes. The core pipeline is on GitHub. For self-hosting, you bring your own Gemini or
            Claude API key. The open-source version includes a yt-dlp fallback for transcript
            extraction when the hosted transcript provider is unavailable — useful if you care
            about resilience or run into region-blocked videos.
          </FaqItem>
          <FaqItem question="What counts as a summary on the free tier?">
            One URL processed = one summary, regardless of video length. Re-processing the same
            URL does not count twice — we dedupe server-side. The counter resets monthly.
          </FaqItem>
          <FaqItem question="Which models does Kura use?">
            The hosted tier uses Gemini 2.5 Flash for structured output. Self-hosters can swap in
            any model that supports structured JSON output — Claude, GPT-4o, local models via an
            OpenAI-compatible endpoint. Model choice is a config flag.
          </FaqItem>
          <FaqItem question="Is my data private?">
            Transcripts and summaries are stored in your account&apos;s database row. They are
            not used to train any model. On self-host, nothing leaves your machine except the
            call to the LLM provider you chose. See the privacy policy for the full story.
          </FaqItem>
          <FaqItem question="What happens if I cancel Pro?">
            Your summaries remain accessible and exportable. You drop to the free tier
            (10/month). No data is deleted.
          </FaqItem>
        </div>
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

function FaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-[var(--border)] py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="font-mono text-lg leading-none text-[var(--muted-foreground)] group-open:hidden"
        >
          +
        </span>
        <span
          aria-hidden="true"
          className="hidden font-mono text-lg leading-none text-[var(--muted-foreground)] group-open:inline"
        >
          −
        </span>
      </summary>
      <div className="mt-3 text-sm text-[var(--muted-foreground)]">{children}</div>
    </details>
  );
}

function Workflow({
  label,
  steps,
  total,
}: {
  label: string;
  steps: string[];
  total: string;
}) {
  return (
    <div className="flex flex-col">
      <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </div>
      <ol className="mt-4 space-y-2 text-sm">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="font-mono tabular-nums text-[var(--muted-foreground)]">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6 font-mono text-2xl">{total}</div>
    </div>
  );
}

