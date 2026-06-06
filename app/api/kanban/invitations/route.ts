import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db, kanbanBoards, users } from "@/db";
import { getDatabaseUser } from "@/lib/kanban";

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await db
    .select({
      board: kanbanBoards,
      ownerEmail: users.email,
    })
    .from(kanbanBoards)
    .innerJoin(users, sql`${kanbanBoards.userId} = ${users.id}`)
    .where(sql`${kanbanBoards.pendingEmails} @> ${JSON.stringify([user.email])}::jsonb`);
    
  const boards = rows.map(r => ({
    ...r.board,
    ownerEmail: r.ownerEmail
  }));

  return NextResponse.json({ boards });
}
