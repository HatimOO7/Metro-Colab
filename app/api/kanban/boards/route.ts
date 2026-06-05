import { NextResponse } from "next/server";

import { db, kanbanBoards, kanbanColumns } from "@/db";
import {
  defaultKanbanColumns,
  getBoardsWithDetails,
  getDatabaseUser,
  normalizeText,
} from "@/lib/kanban";

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await getBoardsWithDetails(user.id);

  return NextResponse.json({ boards });
}

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
  const name = normalizeText(record.name);
  const color = normalizeText(record.color);

  if (!name || !color) {
    return NextResponse.json({ error: "Board name and color are required" }, { status: 400 });
  }

  const [board] = await db
    .insert(kanbanBoards)
    .values({
      userId: user.id,
      name,
      color,
      updatedAt: new Date(),
    })
    .returning();

  await db.insert(kanbanColumns).values(
    defaultKanbanColumns.map((columnName, index) => ({
      boardId: board.id,
      name: columnName,
      position: index,
      updatedAt: new Date(),
    }))
  );

  const boards = await getBoardsWithDetails(user.id);
  const createdBoard = boards.find((currentBoard) => currentBoard.id === board.id);

  return NextResponse.json({ board: createdBoard }, { status: 201 });
}
