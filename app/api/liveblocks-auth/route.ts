import { Liveblocks } from "@liveblocks/node";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { kanbanBoards, users } from "@/db/schema";
import { parseUserInboxEmail } from "@/lib/liveblocks-shared";
import { ensureUserInboxRoom, ensureWhiteboardRoom } from "@/lib/liveblocks-whiteboard";
import { getWhiteboardOwnerEmail, getWhiteboardWithAccess } from "@/lib/whiteboard";
import { getSpaceWithAccess } from "@/lib/spaces";
import { getPageWithSpaceAccess } from "@/lib/pages";
import { eq } from "drizzle-orm";

const liveblocks = new Liveblocks({
  secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const dbUser = await db.query.users.findFirst({
      where: eq(users.clerkId, userId),
    });

    if (!dbUser || !dbUser.email) {
      return new NextResponse("User not found or no email in database", { status: 404 });
    }

    const body = await request.json();
    const { room } = body;

    const email = dbUser.email.toLowerCase();

    const userInfo = {
      name: dbUser.name || (dbUser.firstName ? `${dbUser.firstName} ${dbUser.lastName ?? ""}`.trim() : email),
      email,
      avatar: dbUser.imageUrl ?? undefined,
    };

    const session = liveblocks.prepareSession(email, { userInfo });

    if (room && room.startsWith("kanban-board-")) {
      const boardId = parseInt(room.replace("kanban-board-", ""), 10);
      if (!isNaN(boardId)) {
        const board = await db.query.kanbanBoards.findFirst({
          where: eq(kanbanBoards.id, boardId),
        });

        if (board) {
          if (
            board.userId === dbUser.id ||
            (board.sharedEmails && board.sharedEmails.map((e) => e.toLowerCase()).includes(email))
          ) {
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
          getWhiteboardOwnerEmail(board.userId).then((ownerEmail) => {
            if (ownerEmail) {
              ensureWhiteboardRoom(boardId, ownerEmail, board.name).catch((err) =>
                console.error("Background ensureWhiteboardRoom failed:", err)
              );
            }
          }).catch((err) => console.error(err));
          
          session.allow(room, session.FULL_ACCESS);
        } else {
          return new NextResponse("Forbidden", { status: 403 });
        }
      }
    } else if (room && room.startsWith("user-inbox-")) {
      const inboxEmail = parseUserInboxEmail(room);
      if (inboxEmail && inboxEmail === email) {
        ensureUserInboxRoom(email).catch((err) =>
          console.error("Background ensureUserInboxRoom failed:", err)
        );
        session.allow(room, session.FULL_ACCESS);
      } else {
        return new NextResponse("Forbidden", { status: 403 });
      }
    } else if (room && room.startsWith("space-")) {
      const spaceId = parseInt(room.replace("space-", ""), 10);
      if (!isNaN(spaceId)) {
        const space = await getSpaceWithAccess(spaceId, dbUser.id, email);
        if (space) {
          session.allow(room, session.FULL_ACCESS);
        } else {
          return new NextResponse("Forbidden", { status: 403 });
        }
      } else {
        return new NextResponse("Invalid space room", { status: 400 });
      }
    } else if (room && room.startsWith("page-")) {
      const pageId = parseInt(room.replace("page-", ""), 10);
      if (!isNaN(pageId)) {
        const row = await getPageWithSpaceAccess(pageId, dbUser.id, email);
        if (row) {
          session.allow(room, session.FULL_ACCESS);
        } else {
          return new NextResponse("Forbidden", { status: 403 });
        }
      } else {
        return new NextResponse("Invalid page room", { status: 400 });
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