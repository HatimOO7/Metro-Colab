import { Liveblocks } from "@liveblocks/node";
import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { kanbanBoards, users } from "@/db/schema";
import { parseUserInboxEmail } from "@/lib/liveblocks-shared";
import { ensureUserInboxRoom, ensureWhiteboardRoom } from "@/lib/liveblocks-whiteboard";
import { getWhiteboardOwnerEmail, getWhiteboardWithAccess } from "@/lib/whiteboard";
import { eq } from "drizzle-orm";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: Request) {
  try {
    const user = await currentUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, user.id),
    });

    if (!dbUser) {
      return new NextResponse("User not found in database", { status: 404 });
    }

    const body = await request.json();
    const { room } = body;

    const email = user.emailAddresses[0]?.emailAddress;
    
    if (!email) {
      return new NextResponse("User has no email address", { status: 400 });
    }

    const userInfo = {
      name: user.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : email,
      email: email,
      avatar: user.imageUrl,
    };

    const session = liveblocks.prepareSession(email, { userInfo });

    if (room && room.startsWith("kanban-board-")) {
      const boardId = parseInt(room.replace("kanban-board-", ""), 10);

      if (!isNaN(boardId)) {
        const board = await db.query.kanbanBoards.findFirst({
          where: eq(kanbanBoards.id, boardId),
        });

        if (board) {
          if (board.userId === dbUser.id || (board.sharedEmails && board.sharedEmails.includes(email))) {
            session.allow(room, session.FULL_ACCESS);
          } else {
            return new NextResponse("Forbidden", { status: 403 });
          }
        } else {
          return new NextResponse("Board not found", { status: 404 });
        }
      }
    } else if (room && room.startsWith("whiteboard-")) {
      const boardId = parseInt(room.replace("whiteboard-", ""), 10);

      if (!isNaN(boardId)) {
        const board = await getWhiteboardWithAccess(boardId, dbUser.id, email);

        if (board) {
          const ownerEmail = await getWhiteboardOwnerEmail(board.userId);
          if (ownerEmail) {
            await ensureWhiteboardRoom(boardId, ownerEmail, board.name);
          }
          session.allow(room, session.FULL_ACCESS);
        } else {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
    } else if (room && room.startsWith("user-inbox-")) {
      const inboxEmail = parseUserInboxEmail(room);

      if (inboxEmail && inboxEmail === email.toLowerCase()) {
        await ensureUserInboxRoom(email);
        session.allow(room, session.FULL_ACCESS);
      } else {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else {
      return new NextResponse("Invalid room", { status: 400 });
    }

    const { status, body: authBody } = await session.authorize();
    return new NextResponse(authBody, { status });
  } catch (error) {
    console.error("Liveblocks auth error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
