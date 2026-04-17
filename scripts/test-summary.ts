// Usage: npx tsx scripts/test-summary.ts <URL>
import { extractYoutubeId } from '../src/lib/youtube';
import { fetchVideo } from '../src/lib/supadata';
import { generateSummary } from '../src/lib/llm/gemini';
import { SYSTEM_TEMPLATES } from '../src/lib/templates/system-templates';

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error('Usage: npx tsx scripts/test-summary.ts <youtube-url>');
    process.exit(1);
  }

  const id = extractYoutubeId(input);
  if (!id) throw new Error('Invalid YouTube URL');

  const video = await fetchVideo(id);
  console.log(`Fetched: ${video.title} (${video.segments.length} segments)`);

  const template = SYSTEM_TEMPLATES[0];
  const result = await generateSummary({ video, promptTemplate: template.promptTemplate });

  console.log('---');
  console.log('oneLineSummary:', result.content.oneLineSummary);
  console.log('cliffNotes:', result.content.cliffNotes);
  console.log('tags:', result.content.tags);
  console.log('---');
  console.log(
    `tokens in/out: ${result.tokensInput}/${result.tokensOutput} | cost: $${(result.costUsdCents / 100).toFixed(4)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
