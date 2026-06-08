import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users, whiteboards } from "@/db";
import { broadcastIncomingCall } from "@/lib/liveblocks-whiteboard";
import { getDatabaseUser, getWhiteboardWithAccess } from "@/lib/whiteboard";

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
      return NextResponse.json({ error: "Invalid board id" }, { status: 400 });
    }

    const board = await getWhiteboardWithAccess(boardId, user.id, user.email);

    if (!board) {
      return NextResponse.json({ error: "Board not found" }, { status: 404 });
    }

    const callerName =
      user.name?.trim() ||
      [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
      user.email;

    const sharedEmails = (board.sharedEmails ?? []).filter((email) => email.toLowerCase() !== user.email.toLowerCase());

    let ownerEmail: string | null = null;

    if (board.userId !== user.id) {
      const [owner] = await db.select({ email: users.email }).from(users).where(eq(users.id, board.userId));
      ownerEmail = owner?.email ?? null;
    }

    const recipientEmails = new Set(sharedEmails);

    if (ownerEmail && ownerEmail.toLowerCase() !== user.email.toLowerCase()) {
      recipientEmails.add(ownerEmail);
    }

    const event = await broadcastIncomingCall(Array.from(recipientEmails), {
      boardId,
      boardName: board.name,
      callerName,
      callerEmail: user.email,
      roomName: `whiteboard-${boardId}`,
    });

    return NextResponse.json({ success: true, callId: event.callId });
  } catch (error) {
    console.error("Failed to ring collaborators:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
