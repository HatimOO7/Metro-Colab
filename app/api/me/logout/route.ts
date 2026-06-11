import { NextResponse } from "next/server";

import { getAuthenticatedDbUser } from "@/lib/api-auth";

export async function POST() {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ success: true });
}
