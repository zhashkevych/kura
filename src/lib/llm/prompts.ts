import { formatTranscriptWithTimestamps, type VideoPayload } from '@/lib/supadata';

export type PromptInputs = {
  promptTemplate: string;
  video: VideoPayload;
};

export function buildPrompt({ promptTemplate, video }: PromptInputs): string {
  const durationMinutes =
    video.durationSeconds != null ? Math.round(video.durationSeconds / 60).toString() : 'unknown';
  const publishedDate = video.publishedAt?.toISOString().slice(0, 10) ?? 'unknown';
  const transcript =
    video.segments.length > 0 ? formatTranscriptWithTimestamps(video.segments) : video.transcriptText;

  return promptTemplate
    .replaceAll('{{title}}', video.title)
    .replaceAll('{{channelName}}', video.channelName)
    .replaceAll('{{durationMinutes}}', durationMinutes)
    .replaceAll('{{publishedDate}}', publishedDate)
    .replaceAll('{{transcript}}', transcript);
}
