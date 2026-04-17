import { NextResponse } from 'next/server';
import { pingDb } from '@/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbOk = await pingDb();
  return NextResponse.json(
    {
      status: 'ok',
      db: dbOk ? 'connected' : 'disconnected',
    },
    { status: dbOk ? 200 : 503 },
  );
}
