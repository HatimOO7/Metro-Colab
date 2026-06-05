import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";

import { db, kanbanColumns } from "@/db";
import { getBoardsWithDetails, getDatabaseUser, getUserBoard, maxKanbanColumns, normalizeText } from "@/lib/kanban";

export async function POST(request: Request) {
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
  const name = normalizeText(record.name);

  if (!Number.isInteger(boardId)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Column name is required" }, { status: 400 });
  }

  const board = await getUserBoard(boardId, user.id);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const [columnTotal] = await db.select({ value: count() }).from(kanbanColumns).where(eq(kanbanColumns.boardId, boardId));

  if (columnTotal.value >= maxKanbanColumns) {
    return NextResponse.json({ error: `Boards can have at most ${maxKanbanColumns} columns` }, { status: 400 });
  }

  const [column] = await db
    .insert(kanbanColumns)
    .values({
      boardId,
      name,
      position: columnTotal.value,
      updatedAt: new Date(),
    })
    .returning();

  const boards = await getBoardsWithDetails(user.id);
  return NextResponse.json(
    { column, board: boards.find((currentBoard) => currentBoard.id === boardId) },
    { status: 201 }
  );
}
