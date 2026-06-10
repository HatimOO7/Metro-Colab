import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { inviteSpaceCollaborator, removeSpaceCollaborator } from "@/lib/spaces";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const spaceId = parseInt(id, 10);
    if (isNaN(spaceId)) return NextResponse.json({ error: "Invalid space id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    const email =
      body && typeof body === "object" && typeof (body as { email?: string }).email === "string"
        ? (body as { email: string }).email
        : "";

    if (!email.trim()) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const result = await inviteSpaceCollaborator(spaceId, auth.dbUser.id, email);
    if ("error" in result && result.error) {
      const status = result.error.includes("not found") ? 404 : 403;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ invitation: result.invitation });
  } catch (error) {
    console.error("POST /api/spaces/[id]/share error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const spaceId = parseInt(id, 10);
    if (isNaN(spaceId)) return NextResponse.json({ error: "Invalid space id" }, { status: 400 });

    const body = await request.json().catch(() => null);
    const email =
      body && typeof body === "object" && typeof (body as { email?: string }).email === "string"
        ? (body as { email: string }).email
        : "";

    if (!email.trim()) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const result = await removeSpaceCollaborator(spaceId, auth.dbUser.id, email);
    if ("error" in result && result.error) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/spaces/[id]/share error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
