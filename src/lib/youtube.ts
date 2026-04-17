const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;

export function extractYoutubeId(input: string): string | null {
  if (!input) return null;
  const raw = input.trim();

  if (YOUTUBE_ID_REGEX.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return YOUTUBE_ID_REGEX.test(id) ? id : null;
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (url.pathname === '/watch') {
      const v = url.searchParams.get('v');
      return v && YOUTUBE_ID_REGEX.test(v) ? v : null;
    }
    const m = url.pathname.match(/^\/(?:shorts|embed|v|live)\/([^/?#]+)/);
    if (m && YOUTUBE_ID_REGEX.test(m[1])) return m[1];
  }

  return null;
}

export function formatTimestamp(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function buildTimestampUrl(youtubeId: string, startSeconds: number): string {
  const t = Math.max(0, Math.floor(startSeconds));
  return `https://www.youtube.com/watch?v=${youtubeId}&t=${t}s`;
}

export function slugify(input: string, maxLen = 60): string {
  const base = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base.slice(0, maxLen).replace(/-+$/g, '') || 'summary';
}
