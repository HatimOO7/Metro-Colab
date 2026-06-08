import { ilike, or } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db, users } from "@/db";
import { getDatabaseUser } from "@/lib/whiteboard";

export async function GET(request: Request) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const pattern = `%${query}%`;

  const results = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      firstName: users.firstName,
      lastName: users.lastName,
      imageUrl: users.imageUrl,
    })
    .from(users)
    .where(or(ilike(users.email, pattern), ilike(users.name, pattern), ilike(users.firstName, pattern), ilike(users.lastName, pattern)))
    .limit(10);

  const filtered = results.filter((result) => result.email.toLowerCase() !== user.email.toLowerCase());

  return NextResponse.json({
    users: filtered.map((result) => ({
      id: result.id,
      email: result.email,
      name:
        result.name?.trim() ||
        [result.firstName, result.lastName].filter(Boolean).join(" ").trim() ||
        result.email,
      imageUrl: result.imageUrl,
    })),
  });
}
