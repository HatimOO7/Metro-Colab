import { NextResponse } from "next/server";

import { requireDashboardAuth, upsertResourceView } from "@/lib/dashboard";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const resourceType = text((body as Record<string, unknown> | null)?.resourceType);
  const module = text((body as Record<string, unknown> | null)?.module);
  const title = text((body as Record<string, unknown> | null)?.title);
  const resourceId = Number((body as Record<string, unknown> | null)?.resourceId);

  if (!resourceType || !module || !title || !Number.isInteger(resourceId)) {
    return NextResponse.json({ error: "resourceType, resourceId, title, and module are required" }, { status: 400 });
  }

  await upsertResourceView({
    userId: auth.dbUser.id,
    resourceType,
    resourceId,
    title,
    module,
    edited: (body as Record<string, unknown> | null)?.edited === true,
  });

  return NextResponse.json({ success: true });
}
