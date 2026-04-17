import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http';
import * as schema from './schema';

type Schema = typeof schema;
type DB = NeonHttpDatabase<Schema>;

let _sql: NeonQueryFunction<false, false> | null = null;
let _db: DB | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  _sql = neon(url);
  return _sql;
}

function getDb(): DB {
  if (_db) return _db;
  _db = drizzle(getSql(), { schema });
  return _db;
}

// Proxy so callers can `import { db } from '@/db'` and use it synchronously,
// while the underlying Neon client is only constructed on first query.
export const db = new Proxy({} as DB, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export async function pingDb(): Promise<boolean> {
  try {
    await getSql()`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
