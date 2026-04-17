import { z } from 'zod';

export const summaryContentSchema = z.object({
  oneLineSummary: z.string().min(10).max(300),
  cliffNotes: z.array(z.string().min(5)).min(3).max(12),
  summary: z.string().min(100).max(4000),
  keyQuotes: z
    .array(
      z.object({
        quote: z.string().min(10),
        startSeconds: z.number().int().nonnegative(),
        timestampLabel: z.string(),
      }),
    )
    .min(1)
    .max(10),
  furtherReading: z
    .array(
      z.object({
        title: z.string(),
        author: z.string().optional(),
        type: z
          .enum(['book', 'paper', 'person', 'tool', 'concept', 'other'])
          .optional(),
        link: z.string().url().optional(),
        context: z.string().optional(),
      }),
    )
    .max(25),
  tags: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .min(2)
    .max(8),
});

export type SummaryContent = z.infer<typeof summaryContentSchema>;

// Hand-written JSON Schema for Gemini's `responseSchema` parameter.
// Kept in lockstep with summaryContentSchema — if you edit one, edit both.
// Gemini accepts a subset of JSON Schema; avoid `additionalProperties`, `format`, etc.
export const summaryContentJsonSchema = {
  type: 'object',
  properties: {
    oneLineSummary: { type: 'string' },
    cliffNotes: {
      type: 'array',
      items: { type: 'string' },
    },
    summary: { type: 'string' },
    keyQuotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          quote: { type: 'string' },
          startSeconds: { type: 'integer' },
          timestampLabel: { type: 'string' },
        },
        required: ['quote', 'startSeconds', 'timestampLabel'],
      },
    },
    furtherReading: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          author: { type: 'string' },
          type: {
            type: 'string',
            enum: ['book', 'paper', 'person', 'tool', 'concept', 'other'],
          },
          link: { type: 'string' },
          context: { type: 'string' },
        },
        required: ['title'],
      },
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: [
    'oneLineSummary',
    'cliffNotes',
    'summary',
    'keyQuotes',
    'furtherReading',
    'tags',
  ],
} as const;
