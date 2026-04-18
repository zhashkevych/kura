'use client';

import { useState } from 'react';
import { SummaryViewer } from './summary-viewer';

type TemplateCardProps = {
  name: string;
  description: string | null;
  isSystem: boolean;
  exampleMarkdown: string | null;
};

export function TemplateCard({ name, description, isSystem, exampleMarkdown }: TemplateCardProps) {
  const [open, setOpen] = useState(false);

  return (
    <li className="py-4">
      <div className="flex items-baseline gap-2">
        <span className="font-medium">{name}</span>
        {isSystem && (
          <span className="text-xs rounded border border-[var(--border)] px-1.5 py-0.5 text-[var(--muted-foreground)]">
            system
          </span>
        )}
      </div>
      {description && (
        <p className="text-sm text-[var(--muted-foreground)] mt-1">{description}</p>
      )}
      {exampleMarkdown && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="mt-3 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] rounded-sm"
          >
            {open ? '▾' : '▸'} Example output
          </button>
          {open && (
            <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--muted)]/30 p-4 text-[70%]">
              <SummaryViewer markdown={exampleMarkdown} />
            </div>
          )}
        </>
      )}
    </li>
  );
}
