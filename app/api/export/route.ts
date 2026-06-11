import { NextResponse } from "next/server";

import { getExportData, requireDashboardAuth } from "@/lib/dashboard";

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getExportData(auth), {
    headers: {
      "Content-Disposition": `attachment; filename="metro-colab-export-${auth.dbUser.id}.json"`,
    },
  });
}
