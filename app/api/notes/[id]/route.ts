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

export async function PATCH(
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
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Extract allowed fields for update
    const updateData: Record<string, unknown> = {};
    const allowedFields = ["title", "content", "icon", "color", "isPinned", "isTrash"];

    for (const field of allowedFields) {
      if (field in body) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    // Always update updatedAt timestamp
    updateData.updatedAt = new Date();

    const [updatedNote] = await db
      .update(notes)
      .set(updateData)
      .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
      .returning();

    if (!updatedNote) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ note: updatedNote });
  } catch (error) {
    console.error("Failed to update note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
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
    const [deletedNote] = await db
      .delete(notes)
      .where(and(eq(notes.id, noteId), eq(notes.userId, user.id)))
      .returning();

    if (!deletedNote) {
      return NextResponse.json({ error: "Note not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ message: "Note deleted successfully", id: noteId });
  } catch (error) {
    console.error("Failed to delete note:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
