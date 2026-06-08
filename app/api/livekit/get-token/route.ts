import { NextResponse } from "next/server";

import { createLiveKitTokenForCurrentUser, getLiveKitConfig } from "@/lib/livekit-token";

export async function POST(request: Request) {
  try {
    if (!getLiveKitConfig()) {
      return NextResponse.json(
        {
          error: "LiveKit is not configured. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL.",
          configured: false,
        },
        { status: 503 }
      );
    }

    const body = await request.json().catch(() => null);
    const room =
      body && typeof body === "object" && typeof (body as { room?: string }).room === "string"
        ? (body as { room: string }).room
        : null;

    if (!room) {
      return NextResponse.json({ error: "Room name is required" }, { status: 400 });
    }

    const payload = await createLiveKitTokenForCurrentUser(room);
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal Server Error";

    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }

    if (message.includes("access")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message === "LiveKit is not configured") {
      return NextResponse.json({ error: message, configured: false }, { status: 503 });
    }

    console.error("LiveKit get-token error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
