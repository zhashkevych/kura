// Usage: SUPADATA_API_KEY=... npx tsx scripts/test-transcript.ts <URL>
import { extractYoutubeId } from '../src/lib/youtube';
import { fetchVideo } from '../src/lib/supadata';

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npx tsx scripts/test-transcript.ts <youtube-url>');
    process.exit(1);
  }

  const id = extractYoutubeId(input);
  if (!id) {
    console.error('Could not extract YouTube ID from input.');
    process.exit(1);
  }

  const video = await fetchVideo(id);
  console.log({
    title: video.title,
    channel: video.channelName,
    duration: video.durationSeconds,
    publishedAt: video.publishedAt,
    segmentCount: video.segments.length,
    transcriptPreview: video.transcriptText.slice(0, 200),
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
