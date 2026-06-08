import { and, desc, eq, sql } from "drizzle-orm";

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
  const owned = await db
    .select()
    .from(whiteboards)
    .where(eq(whiteboards.userId, userId))
    .orderBy(desc(whiteboards.updatedAt));

  const shared = await db
    .select()
    .from(whiteboards)
    .where(sql`${whiteboards.sharedEmails} @> ${JSON.stringify([email])}::jsonb`)
    .orderBy(desc(whiteboards.updatedAt));

  const seen = new Set<number>();
  const boards = [];

  for (const board of [...owned, ...shared]) {
    if (seen.has(board.id)) {
      continue;
    }

    seen.add(board.id);
    boards.push(board);
  }

  return boards.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function getWhiteboardOwnerEmail(userId: number) {
  const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId));
  return owner?.email ?? null;
}
