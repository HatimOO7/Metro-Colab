import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";

import { db, kanbanTasks } from "@/db";
import { mapApiCalendarItem } from "@/lib/calendar-items";
import {
  allowedKanbanPriorities,
  getBoardWithDetails,
  getDatabaseUser,
  getTodayKey,
  getUserBoard,
  getUserColumn,
  normalizeBoolean,
  normalizeLabels,
  normalizeOptionalText,
  normalizeText,
  syncTaskToCalendar,
} from "@/lib/kanban";

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
  const columnId = Number(record.columnId);
  const title = normalizeText(record.title);
  const dueDate = normalizeOptionalText(record.dueDate) ?? getTodayKey();
  const priority = normalizeText(record.priority) || "Medium";

  if (!Number.isInteger(boardId) || !Number.isInteger(columnId)) {
    return NextResponse.json({ error: "Invalid board or column id" }, { status: 400 });
  }

  if (!title) {
    return NextResponse.json({ error: "Task title is required" }, { status: 400 });
  }

  if (!allowedKanbanPriorities.has(priority)) {
    return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
  }

  const [board, columnRow] = await Promise.all([getUserBoard(boardId, user.id), getUserColumn(columnId, user.id)]);

  if (!board || !columnRow || columnRow.column.boardId !== boardId) {
    return NextResponse.json({ error: "Board or column not found" }, { status: 404 });
  }

  const [taskTotal] = await db.select({ value: count() }).from(kanbanTasks).where(eq(kanbanTasks.columnId, columnId));
  const [task] = await db
    .insert(kanbanTasks)
    .values({
      boardId,
      columnId,
      title,
      description: normalizeOptionalText(record.description),
      dueDate,
      priority,
      labels: normalizeLabels(record.labels),
      syncCalendar: normalizeBoolean(record.syncCalendar),
      linkNotes: normalizeBoolean(record.linkNotes),
      position: taskTotal.value,
      updatedAt: new Date(),
    })
    .returning();

  const syncResult = await syncTaskToCalendar(task, user.id);

  return NextResponse.json(
    {
      task: syncResult.task,
      calendarItem: mapApiCalendarItem(syncResult.calendarItem),
      board: await getBoardWithDetails(boardId, user.id),
    },
    { status: 201 }
  );
}
