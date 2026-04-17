import Handlebars from 'handlebars';
import { format } from 'date-fns';
import type { SummaryContent } from '@/types/summary-content';
import { formatTimestamp } from '@/lib/youtube';

const hb = Handlebars.create();

hb.registerHelper('eq', (a: unknown, b: unknown) => a === b);
hb.registerHelper('formatTimestamp', (seconds: number) => formatTimestamp(seconds));
hb.registerHelper('formatDate', (value: Date | string | null | undefined) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
});

const compileCache = new Map<string, Handlebars.TemplateDelegate>();

function compile(key: string, source: string): Handlebars.TemplateDelegate {
  let compiled = compileCache.get(key);
  if (!compiled) {
    compiled = hb.compile(source, { noEscape: true });
    compileCache.set(key, compiled);
  }
  return compiled;
}

export type RenderInput = {
  markdownTemplate: string;
  templateKey: string;
  content: SummaryContent;
  video: {
    youtubeId: string;
    title: string;
    channelName: string;
    durationSeconds: number | null;
    publishedAt: Date | null;
  };
  summary: {
    createdAt: Date;
  };
};

export function renderMarkdown(input: RenderInput): string {
  const compiled = compile(input.templateKey, input.markdownTemplate);
  return compiled({
    content: input.content,
    video: {
      youtubeId: input.video.youtubeId,
      title: input.video.title,
      channelName: input.video.channelName,
      publishedAt: input.video.publishedAt
        ? format(new Date(input.video.publishedAt), 'yyyy-MM-dd')
        : '',
      durationMinutes:
        input.video.durationSeconds != null
          ? Math.round(input.video.durationSeconds / 60)
          : '',
    },
    summary: {
      createdAt: format(new Date(input.summary.createdAt), "yyyy-MM-dd'T'HH:mm:ssXXX"),
    },
  });
}
