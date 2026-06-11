import { NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db, users } from "@/db";
import { getAuthenticatedDbUser } from "@/lib/api-auth";

async function getClerkClient() {
  return typeof clerkClient === "function" ? await clerkClient() : clerkClient;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    id: auth.dbUser.id,
    email: auth.dbUser.email,
    name: auth.dbUser.name,
    imageUrl: auth.dbUser.imageUrl,
  });
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedDbUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = text((body as Record<string, unknown> | null)?.name);
  const email = text((body as Record<string, unknown> | null)?.email).toLowerCase();

  if (!name && !email) {
    return NextResponse.json({ error: "Name or email is required" }, { status: 400 });
  }

  const firstName = name ? name.split(/\s+/)[0] ?? null : auth.dbUser.firstName;
  const lastName = name ? name.split(/\s+/).slice(1).join(" ") || null : auth.dbUser.lastName;

  try {
    const client = await getClerkClient();
    await client.users.updateUser(auth.clerkUser.id, {
      ...(name ? { firstName: firstName ?? undefined, lastName: lastName ?? undefined } : {}),
    });
  } catch (error) {
    console.warn("Clerk profile update failed; saving local profile only:", error);
  }

  const [user] = await db
    .update(users)
    .set({
      ...(name ? { name, firstName, lastName } : {}),
      ...(email ? { email } : {}),
      updatedAt: new Date(),
    })
    .where(eq(users.id, auth.dbUser.id))
    .returning();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    imageUrl: user.imageUrl,
  });
}
