import { NextResponse } from "next/server";

import { getDashboardData, requireDashboardAuth } from "@/lib/dashboard";

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    return NextResponse.json(await getDashboardData(auth));
  } catch (error) {
    console.error("GET /api/dashboard failed:", error);
    return NextResponse.json({ error: "Unable to load dashboard" }, { status: 500 });
  }
}
