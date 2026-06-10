import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";
import { getSpaceMembers, getSpaceWithAccess } from "@/lib/spaces";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const spaceId = parseInt(id, 10);
  if (isNaN(spaceId)) return NextResponse.json({ error: "Invalid space id" }, { status: 400 });

  const space = await getSpaceWithAccess(spaceId, auth.dbUser.id, auth.email);
  if (!space) return NextResponse.json({ error: "Space not found" }, { status: 404 });

  const members = await getSpaceMembers(spaceId);
  if (!members) return NextResponse.json({ error: "Space not found" }, { status: 404 });

  return NextResponse.json({
    isOwner: space.role === "owner",
    ...members,
  });
}
