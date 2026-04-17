import { NextResponse } from 'next/server';
import { asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { templates } from '@/db/schema';
import { getOrCreateAppUser } from '@/lib/auth-helpers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getOrCreateAppUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const rows = await db
    .select({
      id: templates.id,
      name: templates.name,
      description: templates.description,
      isSystem: templates.isSystem,
      userId: templates.userId,
    })
    .from(templates)
    .where(or(isNull(templates.userId), eq(templates.userId, user.id)))
    .orderBy(asc(templates.isSystem), asc(templates.name));

  return NextResponse.json({ items: rows });
}
