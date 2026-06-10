import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { createPage, getPagesForSpace } from "@/lib/pages";
import { getSpaceWithAccess } from "@/lib/spaces";

async function getDbUser() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const dbUser = await db.query.users.findFirst({ where: eq(users.clerkId, user.id) });
  if (!dbUser) return null;
  return { user, dbUser, email };
}

export async function GET(request: Request) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const spaceIdParam = searchParams.get("spaceId");
    if (!spaceIdParam) return new NextResponse("spaceId is required", { status: 400 });

    const spaceId = parseInt(spaceIdParam, 10);
    if (isNaN(spaceId)) return new NextResponse("Invalid spaceId", { status: 400 });

    // Verify access
    const space = await getSpaceWithAccess(spaceId, auth.dbUser.id, auth.email);
    if (!space) return new NextResponse("Not found or forbidden", { status: 404 });

    const allPages = await getPagesForSpace(spaceId);
    return NextResponse.json(allPages);
  } catch (error) {
    console.error("GET /api/pages error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { spaceId, title, template, description } = body;

    if (!spaceId || isNaN(parseInt(spaceId, 10))) {
      return new NextResponse("Valid spaceId is required", { status: 400 });
    }

    const space = await getSpaceWithAccess(parseInt(spaceId, 10), auth.dbUser.id, auth.email);
    if (!space) return new NextResponse("Not found or forbidden", { status: 404 });

    if (!title || typeof title !== "string" || !title.trim()) {
      return new NextResponse("Page title is required", { status: 400 });
    }

    const page = await createPage(parseInt(spaceId, 10), auth.dbUser.id, {
      title,
      template,
      description,
    });

    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    console.error("POST /api/pages error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
