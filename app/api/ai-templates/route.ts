import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { getAiTemplatesForUser, deleteAiTemplate } from "@/lib/ai-templates";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const templates = await getAiTemplatesForUser(user.id);
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("Failed to fetch AI templates:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const templateId = Number(body?.id);

    if (!templateId || isNaN(templateId)) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const deleted = await deleteAiTemplate(user.id, templateId);
    if (!deleted) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete AI template:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
