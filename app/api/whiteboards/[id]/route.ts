import { NextResponse } from "next/server";

import { db, whiteboards } from "@/db";
import { getDatabaseUser, getUserWhiteboard, normalizeText } from "@/lib/whiteboard";
import { and, eq } from "drizzle-orm";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const boardId = Number(id);

  if (!Number.isInteger(boardId)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const board = await getUserWhiteboard(boardId, user.id);

  if (!board) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  return NextResponse.json({ board });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const boardId = Number(id);

  if (!Number.isInteger(boardId)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const existing = await getUserWhiteboard(boardId, user.id);

  if (!existing) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const name = record.name !== undefined ? normalizeText(record.name) : existing.name;
  const color = record.color !== undefined ? normalizeText(record.color) : existing.color;

  if (!name) {
    return NextResponse.json({ error: "Board name is required" }, { status: 400 });
  }

  if (!color) {
    return NextResponse.json({ error: "Board color is required" }, { status: 400 });
  }

  const [board] = await db
    .update(whiteboards)
    .set({ name, color, updatedAt: new Date() })
    .where(and(eq(whiteboards.id, boardId), eq(whiteboards.userId, user.id)))
    .returning();

  return NextResponse.json({ board });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const boardId = Number(id);

  if (!Number.isInteger(boardId)) {
    return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
  }

  const existing = await getUserWhiteboard(boardId, user.id);

  if (!existing) {
    return NextResponse.json({ error: "Board not found" }, { status: 404 });
  }

  await db.delete(whiteboards).where(and(eq(whiteboards.id, boardId), eq(whiteboards.userId, user.id)));

  return NextResponse.json({ success: true });
}
