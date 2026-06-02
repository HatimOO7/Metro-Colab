import "server-only";

import { currentUser } from "@clerk/nextjs/server";

import { db, users } from "@/db";

export async function syncCurrentUserToDatabase() {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.primaryEmailAddress?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress;

  if (!email) {
    throw new Error(`Clerk user ${clerkUser.id} does not have an email address to save.`);
  }

  const fallbackName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");
  const name = clerkUser.fullName ?? (fallbackName || null);
  const now = new Date();

  const [user] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      name,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
      email,
      imageUrl: clerkUser.imageUrl,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: {
        name,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        email,
        imageUrl: clerkUser.imageUrl,
        updatedAt: now,
      },
    })
    .returning();

  return user;
}
