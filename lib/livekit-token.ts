import { AccessToken } from "livekit-server-sdk";

import { getDatabaseUser, getWhiteboardWithAccess } from "@/lib/whiteboard";

type TokenUser = {
  email: string;
  name: string;
  id: number;
};

export function getLiveKitConfig() {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const livekitUrl = process.env.LIVEKIT_URL ?? process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !livekitUrl) {
    return null;
  }

  return { apiKey, apiSecret, livekitUrl };
}

export async function assertLiveKitRoomAccess(room: string, user: TokenUser) {
  if (!room.startsWith("whiteboard-")) {
    throw new Error("Only whiteboard video rooms are supported");
  }

  const boardId = Number.parseInt(room.replace("whiteboard-", ""), 10);

  if (!Number.isInteger(boardId)) {
    throw new Error("Invalid room name");
  }

  const board = await getWhiteboardWithAccess(boardId, user.id, user.email);

  if (!board) {
    throw new Error("You do not have access to this whiteboard call");
  }

  return board;
}

export async function createLiveKitToken(room: string, user: TokenUser) {
  const config = getLiveKitConfig();

  if (!config) {
    throw new Error("LiveKit is not configured");
  }

  await assertLiveKitRoomAccess(room, user);

  const token = new AccessToken(config.apiKey, config.apiSecret, {
    identity: user.email,
    name: user.name,
    ttl: "4h",
  });

  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await token.toJwt();

  return { token: jwt, url: config.livekitUrl };
}

export async function createLiveKitTokenForCurrentUser(room: string) {
  const dbUser = await getDatabaseUser();

  if (!dbUser) {
    throw new Error("Unauthorized");
  }

  const name =
    dbUser.name?.trim() ||
    [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ").trim() ||
    dbUser.email;

  return createLiveKitToken(room, {
    id: dbUser.id,
    email: dbUser.email,
    name,
  });
}
