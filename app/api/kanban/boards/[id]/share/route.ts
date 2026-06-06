import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { kanbanBoards, users } from "@/db/schema";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
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

    if (board.userId !== dbUser.id) {
      return NextResponse.json({ error: "Only the board owner can share it" }, { status: 403 });
    }

    const sharedEmails = board.sharedEmails ?? [];
    const pendingEmails = board.pendingEmails ?? [];
    
    if (sharedEmails.includes(email) || pendingEmails.includes(email)) {
      return NextResponse.json({ board }, { status: 200 }); // Already shared or pending
    }

    const nextPendingEmails = [...pendingEmails, email];

    const [updatedBoard] = await db
      .update(kanbanBoards)
      .set({
        pendingEmails: nextPendingEmails,
        updatedAt: new Date(),
      })
      .where(eq(kanbanBoards.id, boardId))
      .returning();

    const { getBoardWithDetails } = await import("@/lib/kanban");
    const boardWithColumns = await getBoardWithDetails(boardId, dbUser.id);

    return NextResponse.json({ board: boardWithColumns }, { status: 200 });
  } catch (error) {
    console.error("Failed to share board:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
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

    if (board.userId !== dbUser.id && dbUser.email !== email) {
      return NextResponse.json({ error: "Only the board owner can modify sharing, or a user can remove themselves" }, { status: 403 });
    }

    const sharedEmails = board.sharedEmails ?? [];
    const pendingEmails = board.pendingEmails ?? [];
    const nextSharedEmails = sharedEmails.filter((e) => e !== email);
    const nextPendingEmails = pendingEmails.filter((e) => e !== email);

    const [updatedBoard] = await db
      .update(kanbanBoards)
      .set({
        sharedEmails: nextSharedEmails,
        pendingEmails: nextPendingEmails,
        updatedAt: new Date(),
      })
      .where(eq(kanbanBoards.id, boardId))
      .returning();

    const { getBoardWithDetails } = await import("@/lib/kanban");
    const boardWithColumns = await getBoardWithDetails(boardId, dbUser.id);

    return NextResponse.json({ board: boardWithColumns }, { status: 200 });
  } catch (error) {
    console.error("Failed to unshare board:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
