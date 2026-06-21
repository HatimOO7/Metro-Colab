import { Liveblocks } from "@liveblocks/node";
import {
  type IncomingCallEvent,
  userInboxRoomId,
  whiteboardRoomId,
} from "@/lib/liveblocks-shared";
 
export {
  userInboxRoomId,
  whiteboardRoomId,
  parseUserInboxEmail,
  type IncomingCallEvent,
} from "@/lib/liveblocks-shared";
 
const _liveblocks: Liveblocks = (() => {
  const secret = process.env.LIVEBLOCKS_SECRET_KEY;
  if (!secret) throw new Error("LIVEBLOCKS_SECRET_KEY is not configured");
  return new Liveblocks({ secret });
})();
 
function getLiveblocks(): Liveblocks {
  return _liveblocks;
}
 
const roomExistsCache = new Set<string>();
const pendingEnsures = new Map<string, Promise<void>>();
 
async function ensureRoomOnce(
  roomId: string,
  creator: () => Promise<void>
): Promise<void> {
  if (roomExistsCache.has(roomId)) return;
 
  const existing = pendingEnsures.get(roomId);
  if (existing) return existing;
 
  const promise = (async () => {
    try {
      await creator();
      roomExistsCache.add(roomId);
    } finally {
      pendingEnsures.delete(roomId);
    }
  })();
 
  pendingEnsures.set(roomId, promise);
  return promise;
}
 
export async function ensureUserInboxRoom(email: string): Promise<void> {
  const liveblocks = getLiveblocks();
  const roomId = userInboxRoomId(email);
 
  return ensureRoomOnce(roomId, async () => {
    try {
      await liveblocks.getRoom(roomId);
      return; 
    } catch {
    }
 
    await liveblocks.createRoom(roomId, {
      defaultAccesses: [],
      usersAccesses: { [email]: ["room:write"] },
      metadata: { type: "user-inbox", ownerId: email },
    });
  });
}
 
export async function ensureWhiteboardRoom(
  boardId: number,
  ownerEmail: string,
  boardName: string
): Promise<void> {
  const liveblocks = getLiveblocks();
  const roomId = whiteboardRoomId(boardId);
 
  return ensureRoomOnce(roomId, async () => {
    try {
      const room = await liveblocks.getRoom(roomId);
      // Patch missing metadata in one update call if needed
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
    }
 
    await liveblocks.createRoom(roomId, {
      defaultAccesses: [],
      usersAccesses: { [ownerEmail]: ["room:write"] },
      metadata: { ownerId: ownerEmail, boardName, type: "whiteboard" },
    });
  });
}
 
export async function grantWhiteboardWriteAccess(
  boardId: number,
  email: string
): Promise<void> {
  const liveblocks = getLiveblocks();
  await liveblocks.updateRoom(whiteboardRoomId(boardId), {
    usersAccesses: {
      [email]: ["room:write"],
    } as Parameters<typeof liveblocks.updateRoom>[1]["usersAccesses"],
  });
}
 
export async function revokeWhiteboardAccess(
  boardId: number,
  email: string
): Promise<void> {
  const liveblocks = getLiveblocks();
  await liveblocks.updateRoom(whiteboardRoomId(boardId), {
    usersAccesses: {
      [email]: null,
    } as Parameters<typeof liveblocks.updateRoom>[1]["usersAccesses"],
  });
}
 
export async function broadcastIncomingCall(
  recipientEmails: string[],
  payload: Omit<IncomingCallEvent, "type" | "callId" | "timestamp">
): Promise<IncomingCallEvent> {
  const liveblocks = getLiveblocks();
  const event: IncomingCallEvent = {
    type: "INCOMING_CALL",
    callId: crypto.randomUUID(),
    timestamp: Date.now(),
    ...payload,
  };
 
  await Promise.all([
    ...recipientEmails.map(async (email) => {
      await ensureUserInboxRoom(email);
      await liveblocks.broadcastEvent(userInboxRoomId(email), event);
    }),
    liveblocks.broadcastEvent(whiteboardRoomId(payload.boardId), event),
  ]);
 
  return event;
}
 