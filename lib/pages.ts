import { and, desc, eq, sql } from "drizzle-orm";
import { db, pages, spaceMembers, spaces, users } from "@/db";
import { copyPageTaskLinks } from "@/lib/page-tasks";
import { getSpaceRole, hasSpaceAccess } from "@/lib/space-permissions";

export type PageWithUser = typeof pages.$inferSelect & {
  updatedByName?: string;
  updatedByEmail?: string;
};

async function mapPageWithEditor(page: typeof pages.$inferSelect): Promise<PageWithUser> {
  const editorId = page.lastEditedByUserId ?? page.userId;
  const [editor] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, editorId));

  return {
    ...page,
    updatedByName: editor?.name ?? editor?.email ?? undefined,
    updatedByEmail: editor?.email ?? undefined,
  };
}

export async function getPagesForSpace(spaceId: number): Promise<PageWithUser[]> {
  const rows = await db
    .select({
      page: pages,
      editorName: users.name,
      editorEmail: users.email,
    })
    .from(pages)
    .leftJoin(users, eq(users.id, pages.lastEditedByUserId))
    .where(eq(pages.spaceId, spaceId))
    .orderBy(desc(pages.updatedAt));

  return rows.map(({ page, editorName, editorEmail }) => ({
    ...page,
    updatedByName: editorName ?? editorEmail ?? undefined,
    updatedByEmail: editorEmail ?? undefined,
  }));
}

export async function getPageById(pageId: number): Promise<PageWithUser | null> {
  const [row] = await db
    .select({
      page: pages,
      editorName: users.name,
      editorEmail: users.email,
    })
    .from(pages)
    .leftJoin(
      users, 
      eq(users.id, sql`COALESCE(${pages.lastEditedByUserId}, ${pages.userId})`)
    )
    .where(eq(pages.id, pageId));

  if (!row) return null;

  return {
    ...row.page,
    updatedByName: row.editorName ?? row.editorEmail ?? undefined,
    updatedByEmail: row.editorEmail ?? undefined,
  };
}

export async function getPageWithSpaceAccess(
  pageId: number,
  userId: number,
  _email: string
) {
  const [row] = await db
    .select({
      page: pages,
      space: spaces,
      editorName: users.name,
      editorEmail: users.email,
      memberRole: spaceMembers.role, 
    })
    .from(pages)
    .innerJoin(spaces, eq(pages.spaceId, spaces.id))
    .leftJoin(
      users, 
      eq(users.id, sql`COALESCE(${pages.lastEditedByUserId}, ${pages.userId})`)
    )
    .leftJoin(
      spaceMembers, 
      and(eq(spaceMembers.spaceId, spaces.id), eq(spaceMembers.userId, userId))
    )
    .where(eq(pages.id, pageId));

  if (!row) return null;
  let role: "owner" | "collaborator" | null = null;
  
  if (row.space.userId === userId) {
    role = "owner";
  } else if (row.memberRole) {
    role = row.memberRole as "owner" | "collaborator";
  }

  if (!role) return null;

  const pageWithUser: PageWithUser = {
    ...row.page,
    updatedByName: row.editorName ?? row.editorEmail ?? undefined,
    updatedByEmail: row.editorEmail ?? undefined,
  };

  return { page: pageWithUser, space: row.space, role };
}
export async function createPage(
  spaceId: number,
  userId: number,
  data: {
    title: string;
    template?: string;
    description?: string | null;
  }
) {
  const access = await hasSpaceAccess(spaceId, userId);
  if (!access) return null;

  const [page] = await db
    .insert(pages)
    .values({
      spaceId,
      userId,
      lastEditedByUserId: userId,
      title: data.title.trim() || "Untitled Page",
      template: data.template ?? "Blank Page",
      description: data.description?.trim() || null,
    })
    .returning();

  if (!page) throw new Error("Failed to create page");

  await db
    .update(spaces)
    .set({ updatedAt: new Date() })
    .where(eq(spaces.id, spaceId));

  return mapPageWithEditor(page);
}

export async function updatePage(
  pageId: number,
  userId: number,
  data: Partial<{
    title: string;
    description: string | null;
    template: string;
    isFavorite: boolean;
    isArchived: boolean;
  }>
) {
  const [existing] = await db.select().from(pages).where(eq(pages.id, pageId));
  if (!existing) return null;

  const access = await hasSpaceAccess(existing.spaceId, userId);
  if (!access) return null;

  const patch: Record<string, unknown> = {
    ...data,
    updatedAt: new Date(),
    lastEditedByUserId: userId,
  };

  if (typeof data.isArchived === "boolean") {
    patch.archivedAt = data.isArchived ? new Date() : null;
  }

  const [page] = await db
    .update(pages)
    .set(patch)
    .where(eq(pages.id, pageId))
    .returning();

  if (!page) return null;

  await db
    .update(spaces)
    .set({ updatedAt: new Date() })
    .where(eq(spaces.id, page.spaceId));

  return mapPageWithEditor(page);
}

export async function deletePage(pageId: number, spaceId: number, userId: number) {
  const access = await hasSpaceAccess(spaceId, userId);
  if (!access) return false;

  await db
    .delete(pages)
    .where(and(eq(pages.id, pageId), eq(pages.spaceId, spaceId)));

  await db
    .update(spaces)
    .set({ updatedAt: new Date() })
    .where(eq(spaces.id, spaceId));

  return true;
}

export async function duplicatePage(pageId: number, userId: number) {
  const [original] = await db.select().from(pages).where(eq(pages.id, pageId));
  if (!original) return null;

  const access = await hasSpaceAccess(original.spaceId, userId);
  if (!access) return null;

  const [copy] = await db
    .insert(pages)
    .values({
      spaceId: original.spaceId,
      userId,
      lastEditedByUserId: userId,
      title: `${original.title} (Copy)`,
      template: original.template,
      description: original.description,
      commentsCount: 0,
      linkedTasksCount: 0,
    })
    .returning();

  if (!copy) return null;

  await copyPageTaskLinks(original.id, copy.id);
  return mapPageWithEditor(copy);
}
