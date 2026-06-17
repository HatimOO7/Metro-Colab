import { and, desc, eq, sql } from "drizzle-orm";
import { db, pageComments, pages, users } from "@/db";

export type PageCommentWithUser = {
  id: number;
  pageId: number;
  userId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  authorEmail: string;
  authorImageUrl: string | null;
};

export async function getCommentsForPage(pageId: number): Promise<PageCommentWithUser[]> {
  const rows = await db
    .select({
      comment: pageComments,
      userName: users.name,
      userEmail: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      imageUrl: users.imageUrl,
    })
    .from(pageComments)
    .innerJoin(users, eq(pageComments.userId, users.id))
    .where(eq(pageComments.pageId, pageId))
    .orderBy(desc(pageComments.createdAt));

  return rows.map(({ comment, userName, userEmail, firstName, lastName, imageUrl }) => ({
    id: comment.id,
    pageId: comment.pageId,
    userId: comment.userId,
    content: comment.content,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    authorName:
      userName?.trim() ||
      [firstName, lastName].filter(Boolean).join(" ").trim() ||
      userEmail,
    authorEmail: userEmail,
    authorImageUrl: imageUrl,
  }));
}

async function syncCommentsCount(pageId: number) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pageComments)
    .where(eq(pageComments.pageId, pageId));

  await db
    .update(pages)
    .set({ commentsCount: result?.count ?? 0, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
}

export async function createPageComment(pageId: number, userId: number, content: string) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const [comment] = await db
    .insert(pageComments)
    .values({ pageId, userId, content: trimmed })
    .returning();

  if (!comment) return null;
  await db
    .update(pages)
    .set({ commentsCount: sql`comments_count + 1`, updatedAt: new Date() })
    .where(eq(pages.id, pageId));

  return comment;
}

export async function updatePageComment(
  commentId: number,
  userId: number,
  content: string
) {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const [comment] = await db
    .update(pageComments)
    .set({ content: trimmed, updatedAt: new Date() })
    .where(and(eq(pageComments.id, commentId), eq(pageComments.userId, userId)))
    .returning();

  return comment ?? null;
}

export async function deletePageComment(commentId: number, userId: number) {
  const [comment] = await db
    .select()
    .from(pageComments)
    .where(and(eq(pageComments.id, commentId), eq(pageComments.userId, userId)));

  if (!comment) return false;

  await db.delete(pageComments).where(eq(pageComments.id, commentId));
  await db
    .update(pages)
    .set({ commentsCount: sql`comments_count - 1`, updatedAt: new Date() })
    .where(eq(pages.id, comment.pageId));
  return true;
}
