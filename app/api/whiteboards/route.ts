import { desc, eq, inArray, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users, whiteboards } from "@/db";
import { ensureWhiteboardRoom } from "@/lib/liveblocks-whiteboard";
import { getDatabaseUser, normalizeText } from "@/lib/whiteboard";

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        board: whiteboards,
        ownerEmail: users.email,
      })
      .from(whiteboards)
      .innerJoin(users, eq(whiteboards.userId, users.id))
      .where(
        or(
          eq(whiteboards.userId, user.id),
          sql`${whiteboards.sharedEmails} @> ${JSON.stringify([user.email])}::jsonb`
        )
      )
      .orderBy(desc(whiteboards.updatedAt));

    return NextResponse.json({
      boards: rows.map((row) => ({
        ...row.board,
        role: row.board.userId === user.id ? "owner" : "collaborator",
        ownerEmail: row.ownerEmail ?? null,
      })),
    });
  } catch (error) {
    console.error("Error inside whiteboards GET route:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
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

  
  void ensureWhiteboardRoom(board.id, user.email, board.name).catch((err) => {
    console.error("Failed to ensure whiteboard room:", err);
  });

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