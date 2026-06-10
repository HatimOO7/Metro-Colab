import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { getPendingInvitationsForUser } from "@/lib/spaces";

export async function GET() {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invitations = await getPendingInvitationsForUser(auth.email);
  return NextResponse.json({ invitations });
}
