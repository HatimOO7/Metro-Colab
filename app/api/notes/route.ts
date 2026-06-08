import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";

import { db, notes } from "@/db";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch (error) {
    console.error("Error syncing user:", error);
    return null;
  }
}

export async function GET() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userNotes = await db
      .select()
      .from(notes)
      .where(eq(notes.userId, user.id))
      .orderBy(desc(notes.updatedAt));

    return NextResponse.json({ notes: userNotes });
  } catch (error) {
    console.error("Failed to fetch notes:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const [newNote] = await db
      .insert(notes)
      .values({
        userId: user.id,
        title: "Untitled Note",
        content: "",
        icon: "📄",
        color: "amber",
        isPinned: false,
        isTrash: false,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ note: newNote }, { status: 201 });
  } catch (error) {
    console.error("Failed to create note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
