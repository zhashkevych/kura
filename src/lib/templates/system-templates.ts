import { summaryContentJsonSchema } from '@/types/summary-content';

const GENERIC_PROMPT = `You are an expert note-taker building a personal knowledge base. Extract the essential content from this YouTube video transcript.

# Video metadata
Title: {{title}}
Channel: {{channelName}}
Duration: {{durationMinutes}} minutes
Published: {{publishedDate}}

# Transcript (with timestamps)
{{transcript}}

# Instructions
Produce a structured note with the following fields:

1. **oneLineSummary**: A single sentence capturing the core thesis or takeaway.
2. **cliffNotes**: 5–10 bullet points capturing the most important claims, findings, or ideas. Each bullet should be a complete thought, not a fragment. Write as if for your future self re-reading in 6 months. Each cliffNotes bullet must be a single complete sentence under 30 words. If a point requires more, split it into multiple adjacent bullets. Do not merge distinct ideas into compound bullets.
3. **summary**: A 2–4 paragraph prose summary. Flowing, readable, no filler. Preserve the speaker's reasoning chain.
4. **keyQuotes**: 3–7 verbatim quotes that are genuinely insightful, memorable, or represent the core argument. For each, include the startSeconds from the transcript and a human-readable timestampLabel (e.g., "12:34"). Skip filler quotes like "that's a great question."
5. **furtherReading**: Every book, paper, person, tool, or concept mentioned that would be worth following up on. Include author/creator when stated. Include links only if they appear in the transcript.
6. **tags**: 3–6 lowercase kebab-case topical tags for a PKM system (e.g., "macroeconomics", "cognitive-science", "startup-advice"). Prefer specific over generic.

Be rigorous about accuracy: do not paraphrase quotes, do not invent citations, do not smooth over contradictions in the speaker's argument.`;

const INTERVIEW_PROMPT = `${GENERIC_PROMPT}

# Additional context
This is a conversation between multiple people. In your cliff notes and key quotes, attribute claims to the specific speaker when possible (by name if stated, otherwise "Host" / "Guest").`;

const LECTURE_PROMPT = `${GENERIC_PROMPT}

# Additional context
This is structured educational content. Prioritize capturing the conceptual outline and the logical flow of ideas over memorable quotes. cliffNotes should read like a table of contents a student could use to rebuild the lecture from memory.`;

const GENERIC_MARKDOWN = `---
title: "{{video.title}}"
channel: "{{video.channelName}}"
url: "https://www.youtube.com/watch?v={{video.youtubeId}}"
published: {{video.publishedAt}}
duration_minutes: {{video.durationMinutes}}
tags: [{{#each content.tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}]
processed: {{summary.createdAt}}
---

> {{content.oneLineSummary}}

## Cliff Notes
{{#each content.cliffNotes}}
- {{this}}
{{/each}}

## Summary
{{content.summary}}

## Key Quotes
{{#each content.keyQuotes}}
- "{{quote}}" — [{{timestampLabel}}](https://www.youtube.com/watch?v={{../video.youtubeId}}&t={{startSeconds}}s)
{{/each}}

## Further Reading
{{#each content.furtherReading}}
- {{title}}{{#if author}} — {{author}}{{/if}}{{#if link}} — [link]({{link}}){{/if}}
{{/each}}
`;

const INTERVIEW_MARKDOWN = GENERIC_MARKDOWN.replace(
  '## Cliff Notes',
  '## Key points (with speaker attribution)',
);

const LECTURE_MARKDOWN = GENERIC_MARKDOWN.replace('## Cliff Notes', '## Lecture Outline').replace(
  '## Key Quotes',
  '## Notable Claims',
);

export const SYSTEM_TEMPLATES = [
  {
    name: 'General Knowledge Capture',
    description:
      'Balanced summary with cliff notes, quotes, and further reading. Good default for most videos.',
    promptTemplate: GENERIC_PROMPT,
    outputSchema: summaryContentJsonSchema,
    markdownTemplate: GENERIC_MARKDOWN,
  },
  {
    name: 'Interview / Podcast',
    description:
      'Optimized for conversations between 2+ people. Extracts positions per speaker.',
    promptTemplate: INTERVIEW_PROMPT,
    outputSchema: summaryContentJsonSchema,
    markdownTemplate: INTERVIEW_MARKDOWN,
  },
  {
    name: 'Lecture / Tutorial',
    description:
      'Optimized for structured educational content. Emphasizes outline over quotes.',
    promptTemplate: LECTURE_PROMPT,
    outputSchema: summaryContentJsonSchema,
    markdownTemplate: LECTURE_MARKDOWN,
  },
] as const;
