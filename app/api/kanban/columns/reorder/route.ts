import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, kanbanColumns, kanbanBoards } from "@/db";
import { getBoardWithDetails, getDatabaseUser, getUserBoard } from "@/lib/kanban";

export async function PATCH(request: Request) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const record = body as Record<string, unknown>;
  const boardId = Number(record.boardId);
  const columnIds = Array.isArray(record.columnIds) ? record.columnIds.map(Number) : [];

  if (!Number.isInteger(boardId) || columnIds.some((id) => !Number.isInteger(id))) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const board = await getUserBoard(boardId, user.id);
  if (!board) return NextResponse.json({ error: "Board not found" }, { status: 404 });

  if (columnIds.length > 0) {
    const now = new Date();
    const valueRows = columnIds.map((id, position) => sql`(${id}, ${position})`);

    await db.execute(sql`
      UPDATE kanban_columns AS c
      SET
        position = v.position::integer,
        updated_at = ${now}
      FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(id, position)
      WHERE c.id = v.id::integer AND c.board_id = ${boardId}
    `);
  }

  return NextResponse.json({ success: true });
}