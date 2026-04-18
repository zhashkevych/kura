import { env } from './env';

export class TranscriptUnavailableError extends Error {
  code = 'transcript_unavailable' as const;
  constructor(message = 'This video has no available transcript.') {
    super(message);
  }
}

export class VideoPrivateError extends Error {
  code = 'video_private' as const;
  constructor(message = 'This video is private or requires sign-in.') {
    super(message);
  }
}

export class VideoLiveError extends Error {
  code = 'video_live' as const;
  constructor(message = 'Live streams are not supported yet.') {
    super(message);
  }
}

export class VideoNotFoundError extends Error {
  code = 'video_not_found' as const;
  constructor(message = 'Video not found.') {
    super(message);
  }
}

export class SupadataError extends Error {
  code = 'supadata_error' as const;
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type VideoPayload = {
  youtubeId: string;
  title: string;
  channelName: string;
  channelId: string | null;
  durationSeconds: number | null;
  publishedAt: Date | null;
  thumbnailUrl: string | null;
  transcriptText: string;
  segments: TranscriptSegment[];
};

const BASE = 'https://api.supadata.ai/v1';

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function supadataFetch(
  path: string,
  params: Record<string, string>,
  attempt = 0,
): Promise<unknown> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url, {
    headers: { 'x-api-key': env.SUPADATA_API_KEY },
    cache: 'no-store',
  });

  if (res.status === 429 && attempt < 3) {
    const retryAfter = Number(res.headers.get('retry-after'));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1500 * 2 ** attempt;
    await sleep(delayMs);
    return supadataFetch(path, params, attempt + 1);
  }

  if (res.status === 404) throw new VideoNotFoundError();
  if (res.status === 403) throw new VideoPrivateError();

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (/live/i.test(body)) throw new VideoLiveError();
    if (/(transcript|caption).*(unavailable|not available|disabled)/i.test(body)) {
      throw new TranscriptUnavailableError();
    }
    throw new SupadataError(`Supadata ${res.status}: ${body.slice(0, 200)}`, res.status);
  }

  return res.json() as Promise<unknown>;
}

type RawTranscriptResponse = {
  content?: Array<{ text: string; offset?: number; duration?: number }>;
  text?: string;
  lang?: string;
};

type RawMetadataResponse = {
  id?: string;
  title?: string;
  channel?: { name?: string; id?: string };
  duration?: number;
  uploadDate?: string;
  thumbnail?: string;
  isLive?: boolean;
};

export async function fetchVideo(youtubeId: string): Promise<VideoPayload> {
  // Sequential — Supadata's free tier rate-limits concurrent calls.
  const metaRaw = (await supadataFetch('/youtube/video', { id: youtubeId })) as RawMetadataResponse;
  const transcriptRaw = (await supadataFetch('/youtube/transcript', {
    videoId: youtubeId,
    text: 'false',
  })) as RawTranscriptResponse;

  if (metaRaw.isLive) throw new VideoLiveError();

  const segments: TranscriptSegment[] = Array.isArray(transcriptRaw.content)
    ? transcriptRaw.content.map((seg) => {
        const start = (seg.offset ?? 0) / 1000;
        const duration = (seg.duration ?? 0) / 1000;
        return {
          start,
          end: start + duration,
          text: seg.text ?? '',
        };
      })
    : [];

  if (segments.length === 0 && !transcriptRaw.text) {
    throw new TranscriptUnavailableError();
  }

  const transcriptText =
    transcriptRaw.text ?? segments.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim();

  return {
    youtubeId,
    title: metaRaw.title ?? 'Untitled',
    channelName: metaRaw.channel?.name ?? 'Unknown channel',
    channelId: metaRaw.channel?.id ?? null,
    durationSeconds: typeof metaRaw.duration === 'number' ? metaRaw.duration : null,
    publishedAt: metaRaw.uploadDate ? new Date(metaRaw.uploadDate) : null,
    thumbnailUrl: metaRaw.thumbnail ?? `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
    transcriptText,
    segments,
  };
}

export function formatTranscriptWithTimestamps(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return '';
  return segments
    .map((s) => {
      const min = Math.floor(s.start / 60);
      const sec = Math.floor(s.start % 60)
        .toString()
        .padStart(2, '0');
      return `[${min}:${sec}] ${s.text}`;
    })
    .join('\n');
}
