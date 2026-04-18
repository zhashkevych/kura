import generic from './general-knowledge-capture.json';
import interview from './interview-podcast.json';
import lecture from './lecture-tutorial.json';
import type { SummaryContent } from '@/types/summary-content';

export type TemplateSample = {
  video: {
    youtubeId: string;
    title: string;
    channelName: string;
    durationSeconds: number;
    publishedAt: string;
  };
  content: SummaryContent;
};

const SAMPLES_BY_NAME: Record<string, TemplateSample> = {
  'General Knowledge Capture': generic as TemplateSample,
  'Interview / Podcast': interview as TemplateSample,
  'Lecture / Tutorial': lecture as TemplateSample,
};

export function getSampleForTemplate(name: string): TemplateSample | null {
  return SAMPLES_BY_NAME[name] ?? null;
}
