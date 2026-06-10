import type { LiveList, LiveObject } from "@liveblocks/client";
import type { IncomingCallEvent } from "@/lib/liveblocks-shared";
import type { PageTaskData } from "@/lib/page-room-storage";

declare global {
  interface Liveblocks {
    Presence: {
      cursor?: { x: number; y: number } | null;
      name?: string;
      color?: string;
      spaceId?: number | null;
      pageId?: number | null;
    };
    Storage: {
      canvas?: LiveObject<{
        elementsJson: string;
        version: number;
      }>;
      tasks?: LiveList<LiveObject<PageTaskData>>;
    };
    RoomEvent: IncomingCallEvent | { type: "FILES_CHANGED" };
  }
}

export { };
