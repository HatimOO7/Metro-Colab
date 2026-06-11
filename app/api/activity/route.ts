import { NextResponse } from "next/server";

import { getActivityData, requireDashboardAuth } from "@/lib/dashboard";

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ activity: await getActivityData(auth.dbUser.id) });
}
