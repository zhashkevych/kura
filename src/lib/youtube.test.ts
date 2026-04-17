import { describe, expect, it } from 'vitest';
import { buildTimestampUrl, extractYoutubeId, formatTimestamp, slugify } from './youtube';

describe('extractYoutubeId', () => {
  const VALID = 'dQw4w9WgXcQ';

  const cases: Array<[string, string | null]> = [
    [`https://www.youtube.com/watch?v=${VALID}`, VALID],
    [`http://www.youtube.com/watch?v=${VALID}`, VALID],
    [`https://youtube.com/watch?v=${VALID}`, VALID],
    [`https://m.youtube.com/watch?v=${VALID}`, VALID],
    [`https://music.youtube.com/watch?v=${VALID}`, VALID],
    [`https://www.youtube.com/watch?v=${VALID}&t=42s`, VALID],
    [`https://www.youtube.com/watch?v=${VALID}&list=PL12345`, VALID],
    [`https://www.youtube.com/watch?v=${VALID}&si=trackingtoken`, VALID],
    [`https://youtu.be/${VALID}`, VALID],
    [`https://youtu.be/${VALID}?t=123`, VALID],
    [`https://youtu.be/${VALID}?si=abc`, VALID],
    [`https://www.youtube.com/shorts/${VALID}`, VALID],
    [`https://www.youtube.com/embed/${VALID}`, VALID],
    [`https://www.youtube.com/embed/${VALID}?autoplay=1`, VALID],
    [`https://www.youtube.com/v/${VALID}`, VALID],
    [`https://www.youtube.com/live/${VALID}`, VALID],
    [`https://www.youtube-nocookie.com/embed/${VALID}`, VALID],
    [VALID, VALID],
    ['', null],
    ['https://www.youtube.com/watch', null],
    ['https://www.youtube.com/watch?v=tooshort', null],
    ['https://vimeo.com/123456', null],
    ['not a url', null],
    ['https://www.youtube.com/channel/UCxyz', null],
  ];

  it.each(cases)('parses %s → %s', (input, expected) => {
    expect(extractYoutubeId(input)).toBe(expected);
  });
});

describe('formatTimestamp', () => {
  it('formats sub-minute', () => {
    expect(formatTimestamp(42)).toBe('0:42');
  });
  it('formats minutes', () => {
    expect(formatTimestamp(754)).toBe('12:34');
  });
  it('formats hours', () => {
    expect(formatTimestamp(3725)).toBe('1:02:05');
  });
  it('floors fractional seconds', () => {
    expect(formatTimestamp(12.9)).toBe('0:12');
  });
});

describe('buildTimestampUrl', () => {
  it('appends integer seconds', () => {
    expect(buildTimestampUrl('dQw4w9WgXcQ', 90.5)).toBe(
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90s',
    );
  });
});

describe('slugify', () => {
  it('produces kebab-case', () => {
    expect(slugify('Hello, World! 2024')).toBe('hello-world-2024');
  });
  it('falls back when empty', () => {
    expect(slugify('!!!')).toBe('summary');
  });
  it('respects max length', () => {
    expect(slugify('a'.repeat(100), 10)).toBe('aaaaaaaaaa');
  });
});
