import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db, users } from "@/db";
import { getAuthenticatedDbUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const imageUrl = typeof (body as Record<string, unknown> | null)?.imageUrl === "string"
    ? String((body as Record<string, unknown>).imageUrl).trim()
    : "";

  if (!imageUrl) {
    return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
  }

  const [user] = await db
    .update(users)
    .set({ imageUrl, updatedAt: new Date() })
    .where(eq(users.id, auth.dbUser.id))
    .returning();

  return NextResponse.json({ imageUrl: user.imageUrl });
}
