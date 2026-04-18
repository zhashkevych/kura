import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { summaries, templates, videos } from '@/db/schema';
import { decrementQuota } from '@/lib/quota';
import {
  fetchVideo,
  SupadataError,
  TranscriptUnavailableError,
  VideoLiveError,
  VideoNotFoundError,
  VideoPrivateError,
} from '@/lib/supadata';
import { generateSummary } from '@/lib/llm/gemini';

const MAX_DURATION_SECONDS = 2 * 60 * 60; // Videos longer than 2 hours are rejected (Appendix B #4).

export async function processSummary(summaryId: string): Promise<void> {
  const [summaryRow] = await db
    .select({
      summary: summaries,
      video: videos,
      template: templates,
    })
    .from(summaries)
    .innerJoin(videos, eq(videos.id, summaries.videoId))
    .leftJoin(templates, eq(templates.id, summaries.templateId))
    .where(eq(summaries.id, summaryId))
    .limit(1);

  if (!summaryRow) {
    console.error(`[process-summary] ${summaryId} not found`);
    return;
  }

  const { summary, video, template } = summaryRow;
  if (!template) {
    await markFailed(summaryId, 'Template not found.');
    return;
  }

  if (summary.status === 'ready' || summary.status === 'failed') return;

  try {
    await db
      .update(summaries)
      .set({ status: 'processing', updatedAt: new Date() })
      .where(eq(summaries.id, summaryId));

    // Fetch transcript if we only have the stub (youtubeId but no title yet).
    let videoPayload;
    if (!video.transcriptText || !video.title || video.title === '') {
      videoPayload = await fetchVideo(video.youtubeId);

      if (
        videoPayload.durationSeconds != null &&
        videoPayload.durationSeconds > MAX_DURATION_SECONDS
      ) {
        await markFailed(
          summaryId,
          'Videos longer than 2 hours are not supported yet.',
        );
        return;
      }

      await db
        .update(videos)
        .set({
          title: videoPayload.title,
          channelName: videoPayload.channelName,
          channelId: videoPayload.channelId,
          durationSeconds: videoPayload.durationSeconds,
          publishedAt: videoPayload.publishedAt,
          thumbnailUrl: videoPayload.thumbnailUrl,
          transcriptText: videoPayload.transcriptText,
          transcriptSegments: videoPayload.segments,
        })
        .where(eq(videos.id, video.id));
    } else {
      videoPayload = {
        youtubeId: video.youtubeId,
        title: video.title,
        channelName: video.channelName,
        channelId: video.channelId,
        durationSeconds: video.durationSeconds,
        publishedAt: video.publishedAt,
        thumbnailUrl: video.thumbnailUrl,
        transcriptText: video.transcriptText ?? '',
        segments: Array.isArray(video.transcriptSegments)
          ? (video.transcriptSegments as Array<{ start: number; end: number; text: string }>)
          : [],
      };
    }

    const result = await generateSummary({
      video: videoPayload,
      promptTemplate: template.promptTemplate,
    });

    await db
      .update(summaries)
      .set({
        status: 'ready',
        content: result.content,
        modelUsed: result.modelUsed,
        tokensInput: result.tokensInput,
        tokensOutput: result.tokensOutput,
        costUsdCents: result.costUsdCents,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(summaries.id, summaryId));
  } catch (err) {
    const message = toUserFriendlyMessage(err);
    console.error(`[process-summary] ${summaryId} failed:`, err);
    await markFailed(summaryId, message);
  }
}

async function markFailed(summaryId: string, errorMessage: string) {
  const [existing] = await db
    .select({ userId: summaries.userId, status: summaries.status })
    .from(summaries)
    .where(eq(summaries.id, summaryId))
    .limit(1);

  await db
    .update(summaries)
    .set({
      status: 'failed',
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(summaries.id, summaryId));

  // Refund quota so a failed run doesn't count against the user's monthly cap.
  if (existing && existing.status !== 'failed') {
    await decrementQuota(existing.userId);
  }
}

function toUserFriendlyMessage(err: unknown): string {
  if (err instanceof TranscriptUnavailableError)
    return 'This video has no available transcript (no captions, or captions are disabled).';
  if (err instanceof VideoPrivateError)
    return 'This video is private or restricted and cannot be accessed.';
  if (err instanceof VideoLiveError) return 'Live streams are not supported yet.';
  if (err instanceof VideoNotFoundError) return 'Video not found on YouTube.';
  if (err instanceof SupadataError) return 'Transcript service is temporarily unavailable. Please try again.';
  if (err instanceof Error && err.message.includes('schema validation'))
    return 'The AI returned an unexpected response. Please try again.';
  return 'Something went wrong while generating the summary. Please try again.';
}
