import { eq, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, kanbanBoards, kanbanTasks } from "@/db";
import { getAuthenticatedDbUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const boards = await db
    .select({ id: kanbanBoards.id })
    .from(kanbanBoards)
    .where(
      or(
        eq(kanbanBoards.userId, auth.dbUser.id),
        sql`${kanbanBoards.sharedEmails} @> ${JSON.stringify([auth.email])}::jsonb`
      )
    );

  const boardIds = boards.map((b) => b.id);
  if (boardIds.length === 0) {
    return NextResponse.json({ tasks: [] });
  }

  const tasks = await db
    .select({
      id: kanbanTasks.id,
      title: kanbanTasks.title,
      boardId: kanbanTasks.boardId,
      priority: kanbanTasks.priority,
      dueDate: kanbanTasks.dueDate,
    })
    .from(kanbanTasks)
    .where(inArray(kanbanTasks.boardId, boardIds));

  return NextResponse.json({ tasks });
}
