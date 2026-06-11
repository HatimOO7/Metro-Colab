import { NextResponse } from "next/server";

import { getOrCreatePreferences, requireDashboardAuth, updatePreferences } from "@/lib/dashboard";

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ preferences: await getOrCreatePreferences(auth.dbUser.id) });
}

export async function PATCH(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const preferences = await updatePreferences(auth.dbUser.id, body);
  return NextResponse.json({ preferences });
}
