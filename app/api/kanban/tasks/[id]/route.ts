import { after } from "next/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, kanbanTasks } from "@/db";
import {
  allowedKanbanPriorities,
  deleteTaskCalendarItem,
  getBoardWithDetails,
  getDatabaseUser,
  getUserColumn,
  getUserTask,
  normalizeBoolean,
  normalizeLabels,
  normalizeOptionalText,
  normalizeText,
  syncTaskToCalendar,
} from "@/lib/kanban";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function getTaskId(context: RouteContext) {
  const { id } = await context.params;
  const taskId = Number(id);
  return Number.isInteger(taskId) ? taskId : null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = await getTaskId(context);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const row = await getUserTask(taskId, user.id);

  if (!row) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const updates: Partial<typeof kanbanTasks.$inferInsert> = { updatedAt: new Date() };

  if ("title" in record) {
    const title = normalizeText(record.title);
    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }
    updates.title = title;
  }

  if ("description" in record) {
    updates.description = normalizeOptionalText(record.description);
  }

  if ("dueDate" in record) {
    const dueDate = normalizeOptionalText(record.dueDate);
    if (!dueDate) {
      return NextResponse.json({ error: "Due date is required" }, { status: 400 });
    }
    updates.dueDate = dueDate;
  }

  if ("priority" in record) {
    const priority = normalizeText(record.priority);
    if (!allowedKanbanPriorities.has(priority)) {
      return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    }
    updates.priority = priority;
  }

  if ("labels" in record) {
    updates.labels = normalizeLabels(record.labels);
  }

  if ("syncCalendar" in record) {
    updates.syncCalendar = normalizeBoolean(record.syncCalendar);
  }

  if ("linkNotes" in record) {
    updates.linkNotes = normalizeBoolean(record.linkNotes);
  }

  if ("columnId" in record) {
    const columnId = Number(record.columnId);
    if (!Number.isInteger(columnId)) {
      return NextResponse.json({ error: "Invalid column id" }, { status: 400 });
    }

    const columnRow = await getUserColumn(columnId, user.id);

    if (!columnRow || columnRow.column.boardId !== row.task.boardId) {
      return NextResponse.json({ error: "Column not found" }, { status: 404 });
    }

    updates.columnId = columnId;
  }

  if ("position" in record) {
    const position = Number(record.position);
    if (!Number.isInteger(position) || position < 0) {
      return NextResponse.json({ error: "Invalid task position" }, { status: 400 });
    }
    updates.position = position;
  }

  const [task] = await db.update(kanbanTasks).set(updates).where(eq(kanbanTasks.id, taskId)).returning();

  after(async () => {
    try {
      await syncTaskToCalendar(task, user.id);
    } catch (syncError) {
      console.error("Kanban calendar sync failed after task update", syncError);
    }
  });

  return NextResponse.json({
    task,
    board: await getBoardWithDetails(row.task.boardId, user.id),
  });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = await getTaskId(context);

  if (!taskId) {
    return NextResponse.json({ error: "Invalid task id" }, { status: 400 });
  }

  const row = await getUserTask(taskId, user.id);

  if (!row) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const calendarItemId = row.task.calendarItemId;

  const [task] = await db.delete(kanbanTasks).where(eq(kanbanTasks.id, taskId)).returning();

  if (calendarItemId) {
    after(async () => {
      try {
        await deleteTaskCalendarItem(calendarItemId, user.id);
      } catch (syncError) {
        console.error("Kanban calendar cleanup failed after task delete", syncError);
      }
    });
  }

  return NextResponse.json({ task, board: await getBoardWithDetails(row.task.boardId, user.id) });
}
