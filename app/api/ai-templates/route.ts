import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { getAiTemplatesForUser, deleteAiTemplate } from "@/lib/ai-templates";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

// ── GET /api/ai-templates ─────────────────────────────────────────────────────
// Returns all AI templates for the authenticated user, ordered newest-first.

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const templates = await getAiTemplatesForUser(user.id);
    return NextResponse.json({ templates }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/ai-templates] Failed to fetch templates:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── DELETE /api/ai-templates ──────────────────────────────────────────────────
// Deletes a template by ID. Only allows deletion of the user's own templates.
// Cascade deletes will automatically remove associated sidebar pins and states.

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const templateId = Number((body as Record<string, unknown>)?.id);
  if (!templateId || isNaN(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "A valid numeric template ID is required" }, { status: 400 });
  }

  try {
    const deleted = await deleteAiTemplate(user.id, templateId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Template not found or you do not have permission to delete it" },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/ai-templates] Failed to delete template:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
