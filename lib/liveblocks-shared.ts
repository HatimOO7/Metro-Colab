export function whiteboardRoomId(boardId: number) {
  return `whiteboard-${boardId}`;
}

export function userInboxRoomId(email: string) {
  return `user-inbox-${encodeURIComponent(email.toLowerCase())}`;
}

export function parseUserInboxEmail(roomId: string) {
  if (!roomId.startsWith("user-inbox-")) {
    return null;
  }
  return decodeURIComponent(roomId.replace("user-inbox-", "")).toLowerCase();
}

// Pages & Spaces room IDs
export function spaceRoomId(spaceId: number) {
  return `space-${spaceId}`;
}

export function pageRoomId(pageId: number) {
  return `page-${pageId}`;
}

export type IncomingCallEvent = {
  type: "INCOMING_CALL";
  callId: string;
  boardId: number;
  boardName: string;
  callerName: string;
  callerEmail: string;
  roomName: string;
  timestamp: number;
};
