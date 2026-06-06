import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, calendarItems } from "@/db";
import { mapApiCalendarItem, normalizeCalendarDateKey } from "@/lib/calendar-items";
import { syncCalendarDateToKanbanTask } from "@/lib/kanban";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

const allowedTypes = new Set(["task", "reminder"]);
const allowedStatuses = new Set(["scheduled", "draft"]);

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
  const text = normalizeText(value);
  return text.length > 0 ? text : null;
}

async function getDatabaseUser() {
  const user = await syncCurrentUserToDatabase();

  if (!user) {
    return null;
  }

  return user;
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const updates: Partial<typeof calendarItems.$inferInsert> = {
    updatedAt: new Date(),
  };

  if ("title" in record) {
    const title = normalizeText(record.title);
    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    updates.title = title;
  }

  if ("description" in record) {
    updates.description = normalizeOptionalText(record.description);
  }

  if ("itemType" in record) {
    const itemType = normalizeText(record.itemType);
    if (!allowedTypes.has(itemType)) {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 });
    }
    updates.itemType = itemType;
  }

  if ("category" in record) {
    const category = normalizeText(record.category);
    if (!category) {
      return NextResponse.json({ error: "Category is required" }, { status: 400 });
    }
    updates.category = category;
  }

  if ("categoryColor" in record) {
    const categoryColor = normalizeText(record.categoryColor);
    if (!categoryColor) {
      return NextResponse.json({ error: "Category color is required" }, { status: 400 });
    }
    updates.categoryColor = categoryColor;
  }

  if ("scheduledDate" in record) {
    updates.scheduledDate = normalizeCalendarDateKey(normalizeOptionalText(record.scheduledDate));
  }

  if ("scheduledTime" in record) {
    updates.scheduledTime = normalizeOptionalText(record.scheduledTime);
  }

  if ("status" in record) {
    const status = normalizeText(record.status);
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = status;
    if (status === "draft") {
      updates.scheduledDate = null;
    }
  }

  if (updates.status === "scheduled" && updates.scheduledDate === null) {
    return NextResponse.json({ error: "Scheduled items require a date" }, { status: 400 });
  }

  const [item] = await db
    .update(calendarItems)
    .set(updates)
    .where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, user.id)))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
  }

  let linkedKanbanTask = null;

  if ("scheduledDate" in record) {
    linkedKanbanTask = await syncCalendarDateToKanbanTask(item.id, item.scheduledDate, user.id);
  }

  const mappedItem = mapApiCalendarItem(item);

  if (!mappedItem) {
    return NextResponse.json({ error: "Failed to serialize calendar item" }, { status: 500 });
  }

  return NextResponse.json({ item: mappedItem, linkedKanbanTask });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const itemId = Number(id);

  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const [item] = await db
    .delete(calendarItems)
    .where(and(eq(calendarItems.id, itemId), eq(calendarItems.userId, user.id)))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Calendar item not found" }, { status: 404 });
  }

  return NextResponse.json({ item });
}
