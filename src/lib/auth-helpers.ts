import { auth, currentUser } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users, type User } from '@/db/schema';

/**
 * Returns the DB user row for the current Clerk session, creating a row on
 * first access if the Clerk webhook hasn't caught up yet (or isn't wired in
 * local dev). Returns null if not authenticated.
 */
export async function getOrCreateAppUser(): Promise<User | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (existing[0]) return existing[0];

  const clerkUser = await currentUser();
  const email =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    `${clerkId}@placeholder.local`;

  const [inserted] = await db
    .insert(users)
    .values({ clerkId, email })
    .onConflictDoUpdate({ target: users.clerkId, set: { email } })
    .returning();
  return inserted;
}

export async function requireAppUser(): Promise<User> {
  const user = await getOrCreateAppUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
  }
}
