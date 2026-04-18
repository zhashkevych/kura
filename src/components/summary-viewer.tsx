'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function stripFrontmatter(md: string): string {
  if (!md.startsWith('---')) return md;
  const end = md.indexOf('\n---', 3);
  if (end === -1) return md;
  return md.slice(end + 4).replace(/^\s+/, '');
}

export function SummaryViewer({ markdown }: { markdown: string }) {
  const body = stripFrontmatter(markdown);
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h1 className="text-2xl font-semibold mt-6 mb-3" {...props} />,
          h2: (props) => <h2 className="text-lg font-semibold mt-6 mb-2" {...props} />,
          p: (props) => <p className="my-3 leading-relaxed" {...props} />,
          ul: (props) => <ul className="list-disc pl-6 my-3 space-y-1.5" {...props} />,
          li: (props) => <li className="leading-relaxed" {...props} />,
          a: (props) => <a className="text-[var(--primary)] underline" {...props} />,
          blockquote: (props) => (
            <blockquote
              className="border-l-2 border-[var(--muted-foreground)]/40 pl-4 italic text-base text-[var(--foreground)] my-5"
              {...props}
            />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
