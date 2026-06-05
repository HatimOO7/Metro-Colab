import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, kanbanColumns, kanbanBoards } from "@/db";
import { getBoardsWithDetails, getDatabaseUser, getUserBoard } from "@/lib/kanban";

export async function PATCH(request: Request) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const boardId = Number(record.boardId);
  const columnIds = Array.isArray(record.columnIds) ? record.columnIds.map(Number) : [];

  if (!Number.isInteger(boardId) || columnIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const board = await getUserBoard(boardId, user.id);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const existingColumns = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanColumns.boardId, kanbanBoards.id))
    .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanBoards.userId, user.id)));
  const existingIds = new Set(existingColumns.map((column) => column.id));

  if (columnIds.length !== existingIds.size || columnIds.some((id) => !existingIds.has(id))) {
    return NextResponse.json({ error: "Column order must include every column on the board" }, { status: 400 });
  }

  await Promise.all(
    columnIds.map((columnId, position) =>
      db.update(kanbanColumns).set({ position, updatedAt: new Date() }).where(eq(kanbanColumns.id, columnId))
    )
  );

  const boards = await getBoardsWithDetails(user.id);
  return NextResponse.json({ board: boards.find((currentBoard) => currentBoard.id === boardId) });
}
