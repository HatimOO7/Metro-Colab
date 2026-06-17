import { and, desc, eq, sql, or } from "drizzle-orm";

import { db, users, whiteboards } from "@/db";
import { normalizeText } from "@/lib/whiteboard-shared";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

export { boardColors, normalizeText } from "@/lib/whiteboard-shared";

export async function getDatabaseUser() {
  const user = await syncCurrentUserToDatabase();
  return user ?? null;
}

export async function getUserWhiteboard(whiteboardId: number, userId: number) {
  const [board] = await db
    .select()
    .from(whiteboards)
    .where(and(eq(whiteboards.id, whiteboardId), eq(whiteboards.userId, userId)));

  return board ?? null;
}

export async function getWhiteboardWithAccess(whiteboardId: number, userId: number, email: string) {
  const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, whiteboardId));

  if (!board) {
    return null;
  }

  const hasAccess =
    board.userId === userId || (board.sharedEmails && board.sharedEmails.includes(email));

  return hasAccess ? board : null;
}

export async function getWhiteboardsForUser(userId: number, email: string) {
  const boards = await db
    .select()
    .from(whiteboards)
    .where(
      or(
        eq(whiteboards.userId, userId),
        sql`${whiteboards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`
      )
    )
    .orderBy(desc(whiteboards.updatedAt));

  return boards;
}

export async function getWhiteboardOwnerEmail(userId: number) {
  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return owner?.email ?? null;
}