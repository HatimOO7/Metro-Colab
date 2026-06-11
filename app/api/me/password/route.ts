import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getAuthenticatedDbUser } from "@/lib/api-auth";

async function getClerkClient() {
  return typeof clerkClient === "function" ? await clerkClient() : clerkClient;
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const password = typeof (body as Record<string, unknown> | null)?.password === "string"
    ? String((body as Record<string, unknown>).password)
    : "";

  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const client = await getClerkClient();
    await client.users.updateUser(auth.clerkUser.id, { password });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password update failed:", error);
    return NextResponse.json({ error: "Unable to update password" }, { status: 500 });
  }
}
