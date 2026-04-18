'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const YT_URL_REGEX =
  /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube(-nocookie)?\.com|youtu\.be)\//i;

type Template = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
};

export function UrlInputForm({ templates }: { templates: Template[] }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError('Please paste a valid YouTube URL.');
      return;
    }
    if (!YT_URL_REGEX.test(trimmed)) {
      setError('Please paste a valid YouTube URL.');
      return;
    }
    if (!templateId) {
      setError('Pick a template first.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/summaries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), templateId }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        summaryId?: string;
        error?: string;
      };

      if (res.ok || res.status === 409) {
        if (data.summaryId) {
          router.push(`/app/summaries/${data.summaryId}`);
          return;
        }
      }

      setError(data.error ?? `Request failed (${res.status}).`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">YouTube URL</label>
        <input
          type="text"
          autoFocus
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError(null);
          }}
          placeholder="https://www.youtube.com/watch?v=..."
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--primary)]"
          disabled={submitting}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">Template</label>
        <select
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2"
          disabled={submitting}
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        {templates.find((t) => t.id === templateId)?.description && (
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
            {templates.find((t) => t.id === templateId)?.description}
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] px-4 py-2 font-medium disabled:opacity-50"
      >
        {submitting ? 'Starting…' : 'Generate summary'}
      </button>
    </form>
  );
}
