import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { acceptSpaceInvitation } from "@/lib/spaces";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const invitationId = parseInt(id, 10);
    if (isNaN(invitationId)) {
      return NextResponse.json({ error: "Invalid invitation id" }, { status: 400 });
    }

    const result = await acceptSpaceInvitation(invitationId, auth.dbUser.id, auth.email);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, spaceId: result.spaceId });
  } catch (error) {
    console.error("POST /api/spaces/invitations/[id]/accept error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
