import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import type { Config } from 'drizzle-kit';

// .env.local takes precedence over .env, matching Next.js conventions.
loadEnv({ path: '.env.local', override: true });

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  strict: true,
  verbose: true,
} satisfies Config;
