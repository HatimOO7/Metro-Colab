import { Liveblocks } from "@liveblocks/node";
import {
  type IncomingCallEvent,
  userInboxRoomId,
  whiteboardRoomId,
  parseUserInboxEmail
} from "@/lib/liveblocks-shared";

function getLiveblocks() {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) {
    throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
  }
  return new Liveblocks({ secret });
}

export async function ensureUserInboxRoom(email: string) {
  const liveblocks = getLiveblocks();
  const roomId = userInboxRoomId(email);

  try {
    await liveblocks.getRoom(roomId);
    return;
  } catch {
    // Room does not exist yet.
  }

  await liveblocks.createRoom(roomId, {
    defaultAccesses: [],
    usersAccesses: {
      [email]: ["room:write"],
    },
    metadata: {
      type: "user-inbox",
      ownerId: email,
    },
  });
}

export async function ensureWhiteboardRoom(boardId: number, ownerEmail: string, boardName: string) {
  const liveblocks = getLiveblocks();
  const roomId = whiteboardRoomId(boardId);

  try {
    const room = await liveblocks.getRoom(roomId);
    if (!room.metadata?.ownerId) {
      await liveblocks.updateRoom(roomId, {
        metadata: {
          ...room.metadata,
          ownerId: ownerEmail,
          boardName,
          type: "whiteboard",
        },
      });
    }
    return;
  } catch {
    // Room does not exist yet.
  }

  await liveblocks.createRoom(roomId, {
    defaultAccesses: [],
    usersAccesses: {
      [ownerEmail]: ["room:write"],
    },
    metadata: {
      ownerId: ownerEmail,
      boardName,
      type: "whiteboard",
    },
  });
}

export async function grantWhiteboardWriteAccess(boardId: number, email: string) {
  const liveblocks = getLiveblocks();
  const roomId = whiteboardRoomId(boardId);
  const room = await liveblocks.getRoom(roomId);

  const usersAccesses = {
    ...room.usersAccesses,
    [email]: ["room:write"],
  };

  await liveblocks.updateRoom(roomId, {
    usersAccesses: usersAccesses as Parameters<typeof liveblocks.updateRoom>[1]["usersAccesses"],
  });
}

export async function revokeWhiteboardAccess(boardId: number, email: string) {
  const liveblocks = getLiveblocks();
  const roomId = whiteboardRoomId(boardId);
  const room = await liveblocks.getRoom(roomId);
  const usersAccesses = { ...room.usersAccesses };
  delete usersAccesses[email];

  await liveblocks.updateRoom(roomId, {
    usersAccesses: usersAccesses as Parameters<typeof liveblocks.updateRoom>[1]["usersAccesses"],
  });
}

export async function broadcastIncomingCall(
  recipientEmails: string[],
  payload: Omit<IncomingCallEvent, "type" | "callId" | "timestamp">
) {
  const liveblocks = getLiveblocks();
  const event: IncomingCallEvent = {
    type: "INCOMING_CALL",
    callId: crypto.randomUUID(),
    timestamp: Date.now(),
    ...payload,
  };

  await Promise.all(
    recipientEmails.map(async (email) => {
      await ensureUserInboxRoom(email);
      await liveblocks.broadcastEvent(userInboxRoomId(email), event);
    })
  );

  await liveblocks.broadcastEvent(whiteboardRoomId(payload.boardId), event);

  return event;
}