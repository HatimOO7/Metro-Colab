import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import { createSpace, getSpacesForUser } from "@/lib/spaces";
import { getSpacePageCount } from "@/lib/spaces";

async function getDbUser() {
  const user = await currentUser();
  if (!user) return null;
  const email = user.emailAddresses[0]?.emailAddress;
  if (!email) return null;
  const dbUser = await db.query.users.findFirst({ where: eq(users.clerkId, user.id) });
  if (!dbUser) return null;
  return { user, dbUser, email };
}


export async function GET() {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const allSpaces = await getSpacesForUser(auth.dbUser.id, auth.email);
    const spacesWithCounts = await Promise.all(
      allSpaces.map(async (space) => {
        const count = await getSpacePageCount(space.id);
        return { ...space, pageCount: count };
      })
    );

    return NextResponse.json(spacesWithCounts);
  } catch (error) {
    console.error("GET /api/spaces error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await getDbUser();
    if (!auth) return new NextResponse("Unauthorized", { status: 401 });

    const body = await request.json();
    const { name, description, color } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return new NextResponse("Space name is required", { status: 400 });
    }

    const space = await createSpace(auth.dbUser.id, {
      name,
      description,
      color,
    });

    return NextResponse.json(space, { status: 201 });
  } catch (error) {
    console.error("POST /api/spaces error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
