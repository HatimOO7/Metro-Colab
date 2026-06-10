import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { deletePage, duplicatePage, getPageWithSpaceAccess, updatePage } from "@/lib/pages";

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

export async function GET(_request: Request, { params }: Params) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const pageId = parseInt(id, 10);
    if (isNaN(pageId)) return new NextResponse("Invalid page ID", { status: 400 });

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return new NextResponse("Not found or forbidden", { status: 404 });

    return NextResponse.json(row.page);
  } catch (error) {
    console.error("GET /api/pages/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const pageId = parseInt(id, 10);
    if (isNaN(pageId)) return new NextResponse("Invalid page ID", { status: 400 });

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return new NextResponse("Not found or forbidden", { status: 404 });

    const body = await request.json();

    if (body.action === "duplicate") {
      const copy = await duplicatePage(pageId, auth.dbUser.id);
      return NextResponse.json(copy, { status: 201 });
    }

    const updated = await updatePage(pageId, auth.dbUser.id, body);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/pages/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const pageId = parseInt(id, 10);
    if (isNaN(pageId)) return new NextResponse("Invalid page ID", { status: 400 });

    const row = await getPageWithSpaceAccess(pageId, auth.dbUser.id, auth.email);
    if (!row) return new NextResponse("Not found or forbidden", { status: 404 });

    await deletePage(pageId, row.page.spaceId, auth.dbUser.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/pages/[id] error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
