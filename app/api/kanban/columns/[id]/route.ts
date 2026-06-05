import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, kanbanColumns } from "@/db";
import { getBoardsWithDetails, getDatabaseUser, getUserColumn, normalizeText } from "@/lib/kanban";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getColumnId(context: RouteContext) {
  const { id } = await context.params;
  const columnId = Number(id);
  return Number.isInteger(columnId) ? columnId : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const columnId = await getColumnId(context);

  if (!columnId) {
    return NextResponse.json({ error: "Invalid column id" }, { status: 400 });
  }

  const row = await getUserColumn(columnId, user.id);

  if (!row) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const name = normalizeText((body as Record<string, unknown>).name);

  if (!name) {
    return NextResponse.json({ error: "Column name is required" }, { status: 400 });
  }

  const [column] = await db
    .update(kanbanColumns)
    .set({ name, updatedAt: new Date() })
    .where(eq(kanbanColumns.id, columnId))
    .returning();

  const boards = await getBoardsWithDetails(user.id);
  return NextResponse.json({ column, board: boards.find((board) => board.id === row.column.boardId) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const columnId = await getColumnId(context);

  if (!columnId) {
    return NextResponse.json({ error: "Invalid column id" }, { status: 400 });
  }

  const row = await getUserColumn(columnId, user.id);

  if (!row) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const [column] = await db.delete(kanbanColumns).where(eq(kanbanColumns.id, columnId)).returning();
  const boards = await getBoardsWithDetails(user.id);

  return NextResponse.json({ column, board: boards.find((board) => board.id === row.column.boardId) });
}
