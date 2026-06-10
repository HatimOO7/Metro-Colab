import { db } from "@/db";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userIds = searchParams.getAll("userIds");

  if (!userIds || userIds.length === 0) {
    return NextResponse.json([]);
  }

  try {
    const dbUsers = await db.query.users.findMany({
      where: inArray(users.email, userIds),
      columns: {
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
      },
    });

    // Liveblocks resolveUsers expects an array of the same length and order as the userIds requested.
    const results = userIds.map((id) => {
      const u = dbUsers.find((user) => user.email.toLowerCase() === id.toLowerCase());
      if (u) {
        return {
          name: u.name || (u.firstName ? `${u.firstName} ${u.lastName ?? ""}`.trim() : u.email),
          avatar: u.imageUrl,
        };
      }
      return null;
    });

    return NextResponse.json(results);
  } catch (error) {
    console.error("Error resolving users", error);
    return NextResponse.json(userIds.map(() => null), { status: 500 });
  }
}
