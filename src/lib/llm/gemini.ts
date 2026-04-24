import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { env } from '@/lib/env';
import { summaryContentSchema, type SummaryContent } from '@/types/summary-content';
import { buildPrompt } from './prompts';
import type { VideoPayload } from '@/lib/supadata';

const MODEL = 'gemini-2.5-flash';

// Gemini 2.5 Flash public pricing (USD per 1M tokens), rounded up.
const PRICE_PER_1M_INPUT_USD = 0.3;
const PRICE_PER_1M_OUTPUT_USD = 2.5;

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    oneLineSummary: { type: SchemaType.STRING },
    cliffNotes: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    summary: { type: SchemaType.STRING },
    keyQuotes: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          quote: { type: SchemaType.STRING },
          startSeconds: { type: SchemaType.INTEGER },
          timestampLabel: { type: SchemaType.STRING },
        },
        required: ['quote', 'startSeconds', 'timestampLabel'],
      },
    },
    furtherReading: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          author: { type: SchemaType.STRING },
          type: {
            type: SchemaType.STRING,
            format: 'enum',
            enum: ['book', 'paper', 'person', 'tool', 'concept', 'other'],
          },
          link: { type: SchemaType.STRING },
          context: { type: SchemaType.STRING },
        },
        required: ['title'],
      },
    },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['oneLineSummary', 'cliffNotes', 'summary', 'keyQuotes', 'furtherReading', 'tags'],
};

export type GenerateSummaryInput = {
  video: VideoPayload;
  promptTemplate: string;
};

export type GenerateSummaryResult = {
  content: SummaryContent;
  tokensInput: number;
  tokensOutput: number;
  costUsdCents: number;
  modelUsed: string;
};

function centsFromTokens(tokensInput: number, tokensOutput: number): number {
  const usd =
    (tokensInput * PRICE_PER_1M_INPUT_USD + tokensOutput * PRICE_PER_1M_OUTPUT_USD) / 1_000_000;
  return Math.ceil(usd * 100);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateSummary({
  video,
  promptTemplate,
}: GenerateSummaryInput): Promise<GenerateSummaryResult> {
  const client = new GoogleGenerativeAI(env.GOOGLE_GENERATIVE_AI_API_KEY);
  const model = client.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.3,
    },
  });

  const basePrompt = buildPrompt({ promptTemplate, video });

  // One primary attempt + one Zod-repair retry.
  // Transient network/5xx errors get their own exponential backoff inside.
  let lastZodIssue: string | null = null;
  let lastParsed: unknown = null;
  let lastUsage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt =
      attempt === 0
        ? basePrompt
        : `${basePrompt}

# Previous attempt failed schema validation
Zod error: ${lastZodIssue}
Fix the specific issue and return a valid JSON object. Do not include any other text.`;

    const result = await callWithBackoff(() => model.generateContent(prompt));
    const text = result.response.text();
    lastUsage = result.response.usageMetadata;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      lastZodIssue = `Response was not valid JSON: ${(err as Error).message}`;
      continue;
    }
    lastParsed = parsed;

    const check = summaryContentSchema.safeParse(parsed);
    if (check.success) {
      const tokensInput = lastUsage?.promptTokenCount ?? 0;
      const tokensOutput = lastUsage?.candidatesTokenCount ?? 0;
      return {
        content: check.data,
        tokensInput,
        tokensOutput,
        costUsdCents: centsFromTokens(tokensInput, tokensOutput),
        modelUsed: MODEL,
      };
    }

    lastZodIssue = check.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
  }

  // Graceful fallback: if the only remaining issues are over-long string
  // fields, truncate them so we still return a usable summary instead of
  // failing the whole job. Anything else still throws.
  const repaired = repairOverlongStrings(lastParsed);
  if (repaired) {
    const recheck = summaryContentSchema.safeParse(repaired);
    if (recheck.success) {
      const tokensInput = lastUsage?.promptTokenCount ?? 0;
      const tokensOutput = lastUsage?.candidatesTokenCount ?? 0;
      return {
        content: recheck.data,
        tokensInput,
        tokensOutput,
        costUsdCents: centsFromTokens(tokensInput, tokensOutput),
        modelUsed: MODEL,
      };
    }
  }

  throw new Error(`Gemini output failed schema validation after retry: ${lastZodIssue}`);
}

function truncate(s: unknown, max: number): unknown {
  if (typeof s !== 'string' || s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function repairOverlongStrings(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const out: Record<string, unknown> = { ...obj };
  out.oneLineSummary = truncate(obj.oneLineSummary, 300);
  out.summary = truncate(obj.summary, 4000);
  if (Array.isArray(obj.cliffNotes)) {
    out.cliffNotes = obj.cliffNotes.map((n) => truncate(n, 200));
  }
  return out;
}

async function callWithBackoff<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < tries - 1) await sleep(500 * 2 ** i);
    }
  }
  throw lastErr;
}
