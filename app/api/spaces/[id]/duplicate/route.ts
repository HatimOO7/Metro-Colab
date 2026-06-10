import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { duplicateSpace } from "@/lib/spaces";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const auth = await getAuthenticatedDbUser();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const spaceId = parseInt(id, 10);
    if (isNaN(spaceId)) return NextResponse.json({ error: "Invalid space id" }, { status: 400 });

    const copy = await duplicateSpace(spaceId, auth.dbUser.id);
    if (!copy) {
      return NextResponse.json({ error: "Forbidden or space not found" }, { status: 403 });
    }

    return NextResponse.json(copy, { status: 201 });
  } catch (error) {
    console.error("POST /api/spaces/[id]/duplicate error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
