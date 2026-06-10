import { NextResponse } from "next/server";
import { getAuthenticatedDbUser } from "@/lib/api-auth";

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
