import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";

export async function getAuthenticatedDbUser() {
  const user = await currentUser();
  if (!user) return null;

  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;

  const dbUser = await db.query.users.findFirst({ where: eq(users.clerkId, user.id) });
  if (!dbUser) return null;

  return { clerkUser: user, dbUser, email: email.toLowerCase() };
}
