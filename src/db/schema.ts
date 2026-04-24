import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const videos = pgTable('videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  youtubeId: text('youtube_id').notNull().unique(),
  title: text('title').notNull(),
  channelName: text('channel_name').notNull(),
  channelId: text('channel_id'),
  durationSeconds: integer('duration_seconds'),
  publishedAt: timestamp('published_at'),
  thumbnailUrl: text('thumbnail_url'),
  transcriptText: text('transcript_text'),
  transcriptSegments: jsonb('transcript_segments'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: boolean('is_system').notNull().default(false),
  promptTemplate: text('prompt_template').notNull(),
  outputSchema: jsonb('output_schema').notNull(),
  markdownTemplate: text('markdown_template').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const summaries = pgTable(
  'summaries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    videoId: uuid('video_id')
      .notNull()
      .references(() => videos.id),
    templateId: uuid('template_id').references(() => templates.id),
    status: text('status', {
      enum: ['pending', 'processing', 'ready', 'failed'],
    })
      .notNull()
      .default('pending'),
    errorMessage: text('error_message'),
    content: jsonb('content'),
    modelUsed: text('model_used'),
    tokensInput: integer('tokens_input'),
    tokensOutput: integer('tokens_output'),
    costUsdCents: integer('cost_usd_cents'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    userVideoUnique: unique('summaries_user_video_unique').on(t.userId, t.videoId),
    userCreatedIdx: index('summaries_user_created_idx').on(t.userId, t.createdAt),
  }),
);

export const notionConnections = pgTable('notion_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  accessToken: text('access_token').notNull(),
  workspaceId: text('workspace_id').notNull(),
  workspaceName: text('workspace_name'),
  defaultDatabaseId: text('default_database_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const channelSubscriptions = pgTable(
  'channel_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    youtubeChannelId: text('youtube_channel_id').notNull(),
    channelName: text('channel_name').notNull(),
    templateId: uuid('template_id').references(() => templates.id),
    lastCheckedAt: timestamp('last_checked_at'),
    lastProcessedVideoId: text('last_processed_video_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userChannelUnique: unique('channel_subscriptions_user_channel_unique').on(
      t.userId,
      t.youtubeChannelId,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type Summary = typeof summaries.$inferSelect;
export type NewSummary = typeof summaries.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
