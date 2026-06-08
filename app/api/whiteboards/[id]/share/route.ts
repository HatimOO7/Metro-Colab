import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users, whiteboards } from "@/db";
import { getDatabaseUser } from "@/lib/whiteboard";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await getDatabaseUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const boardId = Number(id);

    if (!Number.isInteger(boardId)) {
      return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const email =
      body && typeof body === "object" && typeof (body as { email?: string }).email === "string"
        ? (body as { email: string }).email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, boardId));

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    if (board.userId !== user.id) {
      return NextResponse.json({ error: "Only the board owner can invite collaborators" }, { status: 403 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!targetUser) {
      return NextResponse.json({ error: "No registered user found with that email" }, { status: 404 });
    }

    if (email === user.email.toLowerCase()) {
      return NextResponse.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    const sharedEmails = board.sharedEmails ?? [];
    const pendingEmails = board.pendingEmails ?? [];

    if (sharedEmails.includes(email) || pendingEmails.includes(email)) {
      return NextResponse.json({ board }, { status: 200 });
    }

    const [updatedBoard] = await db
      .update(whiteboards)
      .set({
        pendingEmails: [...pendingEmails, email],
        updatedAt: new Date(),
      })
      .where(eq(whiteboards.id, boardId))
      .returning();

    return NextResponse.json({ board: updatedBoard });
  } catch (error) {
    console.error("Failed to invite whiteboard collaborator:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const user = await getDatabaseUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const boardId = Number(id);

    if (!Number.isInteger(boardId)) {
      return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    const email =
      body && typeof body === "object" && typeof (body as { email?: string }).email === "string"
        ? (body as { email: string }).email.trim().toLowerCase()
        : "";

    if (!email) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const [board] = await db.select().from(whiteboards).where(eq(whiteboards.id, boardId));

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const isOwner = board.userId === user.id;

    if (!isOwner) {
      return NextResponse.json({ error: "Only the board owner can remove collaborators" }, { status: 403 });
    }

    const sharedEmails = (board.sharedEmails ?? []).filter((value) => value !== email);
    const pendingEmails = (board.pendingEmails ?? []).filter((value) => value !== email);

    const [updatedBoard] = await db
      .update(whiteboards)
      .set({
        sharedEmails,
        pendingEmails,
        updatedAt: new Date(),
      })
      .where(eq(whiteboards.id, boardId))
      .returning();

    const { revokeWhiteboardAccess } = await import("@/lib/liveblocks-whiteboard");
    await revokeWhiteboardAccess(boardId, email).catch((revokeError) => {
      console.error("Failed to revoke Liveblocks access:", revokeError);
    });

    return NextResponse.json({ board: updatedBoard });
  } catch (error) {
    console.error("Failed to remove whiteboard collaborator:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
