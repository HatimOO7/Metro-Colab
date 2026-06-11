import { NextResponse } from "next/server";

import { getAccountDeletionPreview, requireDashboardAuth } from "@/lib/dashboard";

export async function POST() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getAccountDeletionPreview(auth));
}
