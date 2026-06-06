import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, kanbanBoards } from "@/db";
import { getDatabaseUser } from "@/lib/kanban";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await getDatabaseUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const boardId = parseInt(params.id, 10);

    if (isNaN(boardId)) {
      return NextResponse.json({ error: "Invalid board ID" }, { status: 400 });
    }

    const board = await db.query.kanbanBoards.findFirst({
      where: eq(kanbanBoards.id, boardId),
    });

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const pendingEmails = board.pendingEmails ?? [];
    if (!pendingEmails.includes(user.email)) {
      return NextResponse.json({ error: "No pending invitation found for this board" }, { status: 403 });
    }

    const sharedEmails = board.sharedEmails ?? [];
    const nextPendingEmails = pendingEmails.filter(e => e !== user.email);
    const nextSharedEmails = sharedEmails.includes(user.email) ? sharedEmails : [...sharedEmails, user.email];

    await db
      .update(kanbanBoards)
      .set({
        pendingEmails: nextPendingEmails,
        sharedEmails: nextSharedEmails,
        updatedAt: new Date(),
      })
      .where(eq(kanbanBoards.id, boardId));

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
