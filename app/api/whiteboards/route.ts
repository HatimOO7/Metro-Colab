import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users, whiteboards } from "@/db";
import { ensureWhiteboardRoom } from "@/lib/liveblocks-whiteboard";
import { getDatabaseUser, getWhiteboardsForUser, normalizeText } from "@/lib/whiteboard";

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const boards = await getWhiteboardsForUser(user.id, user.email);
  const ownerIds = [...new Set(boards.map((board) => board.userId))];
  const owners =
    ownerIds.length > 0
      ? await db
          .select({ id: users.id, email: users.email })
          .from(users)
          .where(inArray(users.id, ownerIds))
      : [];

  const ownerEmailById = new Map(owners.map((owner) => [owner.id, owner.email]));

  return NextResponse.json({
    boards: boards.map((board) => ({
      ...board,
      role: board.userId === user.id ? "owner" : "collaborator",
      ownerEmail: ownerEmailById.get(board.userId) ?? null,
    })),
  });
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
  const name = normalizeText(record.name) || "Untitled whiteboard";
  const color = normalizeText(record.color);

  if (!color) {
    return NextResponse.json({ error: "Board color is required" }, { status: 400 });
  }

  const [board] = await db
    .insert(whiteboards)
    .values({
      userId: user.id,
      name,
      color,
      updatedAt: new Date(),
    })
    .returning();

  await ensureWhiteboardRoom(board.id, user.email, board.name);

  return NextResponse.json(
    {
      board: {
        ...board,
        role: "owner" as const,
        ownerEmail: user.email,
      },
    },
    { status: 201 }
  );
}
