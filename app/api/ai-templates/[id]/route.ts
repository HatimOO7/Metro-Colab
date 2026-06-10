import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { getAiTemplateById } from "@/lib/ai-templates";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const templateId = Number(id);
    if (isNaN(templateId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const template = await getAiTemplateById(user.id, templateId);
    if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ template });
  } catch (err) {
    console.error("Failed to fetch AI template:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
