import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { deleteSpace, getSpaceWithAccess, updateSpace } from "@/lib/spaces";
import { isSpaceOwner } from "@/lib/space-permissions";

async function getDbUser() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const dbUser = await db.query.users.findFirst({ where: eq(users.clerkId, user.id) });
  if (!dbUser) return null;
  return { user, dbUser, email };
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const spaceId = parseInt(id, 10);
    if (isNaN(spaceId)) return new NextResponse("Invalid space ID", { status: 400 });

    const space = await getSpaceWithAccess(spaceId, auth.dbUser.id, auth.email);
    if (!space) return new NextResponse("Not found or forbidden", { status: 404 });

    const body = await request.json();

    if (body.action === "duplicate") {
      return new NextResponse("Use POST /api/spaces/[id]/duplicate", { status: 400 });
    }

    const ownerOnlyFields = ["name", "description", "color", "sharedEmails", "pendingEmails"];
    const hasOwnerOnlyChange = ownerOnlyFields.some((field) => field in body);
    if (hasOwnerOnlyChange && space.role !== "owner") {
      return new NextResponse("Only the space owner can update space settings", { status: 403 });
    }

    if (typeof body.isArchived === "boolean" && space.role !== "owner") {
      return new NextResponse("Only the space owner can archive spaces", { status: 403 });
    }

    const updated = await updateSpace(spaceId, auth.dbUser.id, body);
    if (!updated) return new NextResponse("Forbidden", { status: 403 });
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/spaces/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const spaceId = parseInt(id, 10);
    if (isNaN(spaceId)) return new NextResponse("Invalid space ID", { status: 400 });

    // Only owner can delete
    const space = await getSpaceWithAccess(spaceId, auth.dbUser.id, auth.email);
    if (!space || space.userId !== auth.dbUser.id) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    await deleteSpace(spaceId, auth.dbUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/spaces/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
