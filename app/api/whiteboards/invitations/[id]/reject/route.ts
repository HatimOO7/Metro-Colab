import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, whiteboards } from "@/db";
import { getDatabaseUser } from "@/lib/whiteboard";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await getDatabaseUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const boardId = Number(id);

    if (!Number.isInteger(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, boardId));

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const pendingEmails = board.pendingEmails ?? [];

    if (!pendingEmails.includes(user.email)) {
      return NextResponse.json({ error: "No pending invitation found for this board" }, { status: 403 });
    }

    await db
      .update(whiteboards)
      .set({
        pendingEmails: pendingEmails.filter((email) => email !== user.email),
        updatedAt: new Date(),
      })
      .where(eq(whiteboards.id, boardId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reject whiteboard invitation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
