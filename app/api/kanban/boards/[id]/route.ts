import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, kanbanBoards } from "@/db";
import { getBoardWithDetails, getDatabaseUser, normalizeText } from "@/lib/kanban";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getBoardId(context: RouteContext) {
  const { id } = await context.params;
  const boardId = Number(id);
  return Number.isInteger(boardId) ? boardId : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boardId = await getBoardId(context);

  if (!boardId) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const updates: Partial<typeof kanbanBoards.$inferInsert> = { updatedAt: new Date() };

  if ("name" in record) {
    const name = normalizeText(record.name);
    if (!name) {
      return NextResponse.json({ error: "Board name is required" }, { status: 400 });
    }
    updates.name = name;
  }

  if ("color" in record) {
    const color = normalizeText(record.color);
    if (!color) {
      return NextResponse.json({ error: "Board color is required" }, { status: 400 });
    }
    updates.color = color;
  }

  const [board] = await db
    .update(kanbanBoards)
    .set(updates)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, user.id)))
    .returning();

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ board: await getBoardWithDetails(board.id, user.id) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boardId = await getBoardId(context);

  if (!boardId) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const [board] = await db
    .delete(kanbanBoards)
    .where(and(eq(kanbanBoards.id, boardId), eq(kanbanBoards.userId, user.id)))
    .returning();

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ board });
}
