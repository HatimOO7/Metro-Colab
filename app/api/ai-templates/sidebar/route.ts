import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { getSidebarPins, addSidebarPin, removeSidebarPin } from "@/lib/ai-templates";

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
    const pins = await getSidebarPins(user.id);
    return NextResponse.json({ pins });
  } catch (err) {
    console.error("Failed to fetch sidebar pins:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const templateId = Number(body?.templateId);

    if (!templateId || isNaN(templateId)) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const result = await addSidebarPin(user.id, templateId);
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ pin: result.pin }, { status: 201 });
  } catch (err) {
    console.error("Failed to add sidebar pin:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const templateId = Number(body?.templateId);

    if (!templateId || isNaN(templateId)) {
      return NextResponse.json({ error: "templateId is required" }, { status: 400 });
    }

    const removed = await removeSidebarPin(user.id, templateId);
    if (!removed) return NextResponse.json({ error: "Pin not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to remove sidebar pin:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
