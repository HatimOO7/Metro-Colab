import { NextResponse } from "next/server";

import { getCollaborationData, requireDashboardAuth } from "@/lib/dashboard";

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getCollaborationData(auth));
}
