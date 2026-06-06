import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db, kanbanBoards, kanbanColumns, kanbanTasks } from "@/db";
import { getBoardWithDetails, getDatabaseUser, getUserBoard } from "@/lib/kanban";

type ColumnOrder = {
  columnId: number;
  taskIds: number[];
};

function normalizeOrders(value: unknown): ColumnOrder[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const orders = value.map((item) => {
    if (!item || typeof item !== "object") {
      return null;
    }

    const record = item as Record<string, unknown>;
    const columnId = Number(record.columnId);
    const taskIds = Array.isArray(record.taskIds) ? record.taskIds.map(Number) : [];

    if (!Number.isInteger(columnId) || taskIds.some((taskId) => !Number.isInteger(taskId))) {
      return null;
    }

    return { columnId, taskIds };
  });

  return orders.every(Boolean) ? (orders as ColumnOrder[]) : null;
}

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
  const orders = normalizeOrders(record.columns);

  if (!Number.isInteger(boardId) || !orders?.length) {
    return NextResponse.json({ error: "Invalid reorder payload" }, { status: 400 });
  }

  const board = await getUserBoard(boardId, user.id);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const requestedColumnIds = orders.map((order) => order.columnId);
  const uniqueColumnIds = new Set(requestedColumnIds);

  if (uniqueColumnIds.size !== requestedColumnIds.length) {
    return NextResponse.json({ error: "Duplicate columns are not allowed" }, { status: 400 });
  }

  const columns = await db
    .select({ id: kanbanColumns.id })
    .from(kanbanColumns)
    .innerJoin(kanbanBoards, eq(kanbanColumns.boardId, kanbanBoards.id))
    .where(and(eq(kanbanColumns.boardId, boardId), eq(kanbanBoards.userId, user.id), inArray(kanbanColumns.id, requestedColumnIds)));

  if (columns.length !== requestedColumnIds.length) {
    return NextResponse.json({ error: "Column not found" }, { status: 404 });
  }

  const requestedTaskIds = orders.flatMap((order) => order.taskIds);
  const uniqueTaskIds = new Set(requestedTaskIds);

  if (uniqueTaskIds.size !== requestedTaskIds.length) {
    return NextResponse.json({ error: "Duplicate tasks are not allowed" }, { status: 400 });
  }

  if (requestedTaskIds.length > 0) {
    const tasks = await db
      .select({ id: kanbanTasks.id })
      .from(kanbanTasks)
      .where(and(eq(kanbanTasks.boardId, boardId), inArray(kanbanTasks.id, requestedTaskIds)));

    if (tasks.length !== requestedTaskIds.length) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  const now = new Date();
  const updates = orders.flatMap((order) =>
    order.taskIds.map((taskId, position) => ({
      taskId,
      columnId: order.columnId,
      position,
    }))
  );

  if (updates.length > 0) {
    const valueRows = updates.map(
      (update) => sql`(${update.taskId}, ${update.columnId}, ${update.position})`
    );

    await db.execute(sql`
      UPDATE kanban_tasks AS t
      SET
        column_id = v.column_id::integer,
        position = v.position::integer,
        updated_at = ${now}
      FROM (VALUES ${sql.join(valueRows, sql`, `)}) AS v(id, column_id, position)
      WHERE t.id = v.id::integer AND t.board_id = ${boardId}
    `);
  }

  return NextResponse.json({ board: await getBoardWithDetails(boardId, user.id) });
}
