import { and, eq, sql } from "drizzle-orm";
import { db, kanbanTasks, pageTaskLinks, pages } from "@/db";

export type LinkedTask = {
  id: number;
  title: string;
  boardId: number;
  columnId: number;
  priority: string;
  dueDate: string;
};

export async function getLinkedTasksForPage(pageId: number): Promise<LinkedTask[]> {
  const rows = await db
    .select({
      id: kanbanTasks.id,
      title: kanbanTasks.title,
      boardId: kanbanTasks.boardId,
      columnId: kanbanTasks.columnId,
      priority: kanbanTasks.priority,
      dueDate: kanbanTasks.dueDate,
    })
    .from(pageTaskLinks)
    .innerJoin(kanbanTasks, eq(pageTaskLinks.taskId, kanbanTasks.id))
    .where(eq(pageTaskLinks.pageId, pageId));

  return rows;
}

async function syncLinkedTasksCount(pageId: number) {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pageTaskLinks)
    .where(eq(pageTaskLinks.pageId, pageId));

  await db
    .update(pages)
    .set({ linkedTasksCount: result?.count ?? 0, updatedAt: new Date() })
    .where(eq(pages.id, pageId));
}

export async function attachTaskToPage(pageId: number, taskId: number) {
  const [task] = await db.select().from(kanbanTasks).where(eq(kanbanTasks.id, taskId));
  if (!task) return null;

  const [existing] = await db
    .select()
    .from(pageTaskLinks)
    .where(and(eq(pageTaskLinks.pageId, pageId), eq(pageTaskLinks.taskId, taskId)));

  if (existing) return existing;

  const [link] = await db.insert(pageTaskLinks).values({ pageId, taskId }).returning();
  if (link) await syncLinkedTasksCount(pageId);
  return link ?? null;
}

export async function detachTaskFromPage(pageId: number, taskId: number) {
  await db
    .delete(pageTaskLinks)
    .where(and(eq(pageTaskLinks.pageId, pageId), eq(pageTaskLinks.taskId, taskId)));
  await syncLinkedTasksCount(pageId);
}

export async function copyPageTaskLinks(sourcePageId: number, targetPageId: number) {
  const links = await db
    .select()
    .from(pageTaskLinks)
    .where(eq(pageTaskLinks.pageId, sourcePageId));

  if (links.length === 0) return;

  await db.insert(pageTaskLinks).values(
    links.map((link) => ({
      pageId: targetPageId,
      taskId: link.taskId,
    }))
  );
  await syncLinkedTasksCount(targetPageId);
}
