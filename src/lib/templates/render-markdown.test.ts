import { describe, expect, it } from 'vitest';
import { renderMarkdown } from './render-markdown';
import { SYSTEM_TEMPLATES } from './system-templates';
import type { SummaryContent } from '@/types/summary-content';

const FIXTURE: SummaryContent = {
  oneLineSummary: 'A concise summary of an imagined video.',
  cliffNotes: ['Point one is memorable.', 'Point two builds on it.', 'Point three lands the thesis.'],
  summary: 'This is a long-form summary of the video that spans more than a hundred characters so it passes the Zod min() check comfortably.',
  keyQuotes: [
    { quote: 'The real problem is attention.', startSeconds: 754, timestampLabel: '12:34' },
  ],
  furtherReading: [
    { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', type: 'book' },
  ],
  tags: ['attention', 'cognition'],
};

const VIDEO = {
  youtubeId: 'dQw4w9WgXcQ',
  title: 'Sample Video',
  channelName: 'Sample Channel',
  durationSeconds: 1440,
  publishedAt: new Date('2024-01-15T00:00:00Z'),
};

describe('renderMarkdown', () => {
  it.each(SYSTEM_TEMPLATES.map((t) => [t.name, t] as const))('renders %s', (_name, template) => {
    const md = renderMarkdown({
      markdownTemplate: template.markdownTemplate,
      templateKey: template.name,
      content: FIXTURE,
      video: VIDEO,
      summary: { createdAt: new Date('2024-02-01T10:00:00Z') },
    });

    expect(md).toContain('Sample Video');
    expect(md).toContain('Sample Channel');
    expect(md).toContain('dQw4w9WgXcQ');
    expect(md).toContain('youtube.com/watch?v=dQw4w9WgXcQ&t=754s');
    expect(md).toContain('- Point one is memorable.');
    expect(md).toContain('tags: [attention, cognition]');
    expect(md).toContain('Thinking, Fast and Slow');
  });

  it('interview template uses speaker-attribution heading', () => {
    const interview = SYSTEM_TEMPLATES.find((t) => t.name === 'Interview / Podcast');
    if (!interview) throw new Error('interview template missing');
    const md = renderMarkdown({
      markdownTemplate: interview.markdownTemplate,
      templateKey: interview.name,
      content: FIXTURE,
      video: VIDEO,
      summary: { createdAt: new Date('2024-02-01T10:00:00Z') },
    });
    expect(md).toContain('## Key points (with speaker attribution)');
  });

  it('lecture template uses outline + notable claims headings', () => {
    const lecture = SYSTEM_TEMPLATES.find((t) => t.name === 'Lecture / Tutorial');
    if (!lecture) throw new Error('lecture template missing');
    const md = renderMarkdown({
      markdownTemplate: lecture.markdownTemplate,
      templateKey: lecture.name,
      content: FIXTURE,
      video: VIDEO,
      summary: { createdAt: new Date('2024-02-01T10:00:00Z') },
    });
    expect(md).toContain('## Lecture Outline');
    expect(md).toContain('## Notable Claims');
  });
});
