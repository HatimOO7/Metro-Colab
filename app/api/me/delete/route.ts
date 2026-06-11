import { NextResponse } from "next/server";

import { deleteAccount, requireDashboardAuth } from "@/lib/dashboard";

export async function DELETE(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const passwordConfirmation =
    typeof (body as Record<string, unknown> | null)?.passwordConfirmation === "string"
      ? String((body as Record<string, unknown>).passwordConfirmation)
      : "";

  const result = await deleteAccount(auth, passwordConfirmation);
  if ("error" in result) {
    return NextResponse.json(result, { status: 409 });
  }

  return NextResponse.json(result);
}
