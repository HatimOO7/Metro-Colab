import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db, users, whiteboards } from "@/db";
import { getDatabaseUser } from "@/lib/whiteboard";

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      board: whiteboards,
      ownerEmail: users.email,
      ownerName: users.name,
      ownerFirstName: users.firstName,
      ownerLastName: users.lastName,
    })
    .from(whiteboards)
    .innerJoin(users, sql`${whiteboards.userId} = ${users.id}`)
    .where(sql`${whiteboards.pendingEmails} @> ${JSON.stringify([user.email])}::jsonb`);

  const boards = rows.map((row) => ({
    ...row.board,
    ownerEmail: row.ownerEmail,
    ownerName:
      row.ownerName?.trim() ||
      [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" ").trim() ||
      row.ownerEmail,
  }));

  return NextResponse.json({ boards });
}
