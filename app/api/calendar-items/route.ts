import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, calendarItems } from "@/db";
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

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await db
    .select()
    .from(calendarItems)
    .where(eq(calendarItems.userId, user.id));

  return NextResponse.json({ items });
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

  const title = normalizeText((body as Record<string, unknown>).title);
  const category = normalizeText((body as Record<string, unknown>).category);
  const categoryColor = normalizeText((body as Record<string, unknown>).categoryColor);
  const requestedType = normalizeText((body as Record<string, unknown>).itemType);
  const requestedStatus = normalizeText((body as Record<string, unknown>).status);
  const status = allowedStatuses.has(requestedStatus) ? requestedStatus : "scheduled";
  const scheduledDate = normalizeOptionalText((body as Record<string, unknown>).scheduledDate);

  if (!title || !category || !categoryColor) {
    return NextResponse.json({ error: "Title, category, and category color are required" }, { status: 400 });
  }

  if (status === "scheduled" && !scheduledDate) {
    return NextResponse.json({ error: "Scheduled items require a date" }, { status: 400 });
  }

  const [item] = await db
    .insert(calendarItems)
    .values({
      userId: user.id,
      title,
      description: normalizeOptionalText((body as Record<string, unknown>).description),
      itemType: allowedTypes.has(requestedType) ? requestedType : "task",
      category,
      categoryColor,
      scheduledDate: status === "draft" ? null : scheduledDate,
      scheduledTime: normalizeOptionalText((body as Record<string, unknown>).scheduledTime),
      status,
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json({ item }, { status: 201 });
}
