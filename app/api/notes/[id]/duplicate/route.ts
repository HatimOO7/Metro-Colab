import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";

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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const noteId = parseInt(id, 10);

  if (isNaN(noteId)) {
    return NextResponse.json({ error: "Invalid note ID" }, { status: 400 });
  }

  try {
    // Fetch the original note
    const [originalNote] = await db
      .select()
      .from(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)));

    if (!originalNote) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 });
    }

    const now = new Date();
    const duplicateTitle = originalNote.title.endsWith(" (Copy)")
      ? originalNote.title
      : `${originalNote.title} (Copy)`;

    // Insert duplicate
    const [duplicatedNote] = await db
      .insert(notes)
      .values({
        userId: user.id,
        title: duplicateTitle,
        content: originalNote.content,
        icon: originalNote.icon,
        color: originalNote.color,
        isPinned: originalNote.isPinned,
        isTrash: false, // Must not be in trash
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return NextResponse.json({ note: duplicatedNote }, { status: 201 });
  } catch (error) {
    console.error("Failed to duplicate note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
