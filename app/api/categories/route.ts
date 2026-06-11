import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db, userCategories } from "@/db";
import { ensureDefaultCategories, normalizeCategoryScope, requireDashboardAuth } from "@/lib/dashboard";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET() {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ categories: await ensureDefaultCategories(auth.dbUser.id) });
}

export async function POST(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const scope = normalizeCategoryScope((body as Record<string, unknown> | null)?.scope);
  const name = text((body as Record<string, unknown> | null)?.name);
  const color = text((body as Record<string, unknown> | null)?.color);
  const icon = text((body as Record<string, unknown> | null)?.icon) || "Tag";

  if (!scope || !name || !color) {
    return NextResponse.json({ error: "Scope, name, and color are required" }, { status: 400 });
  }

  const [category] = await db
    .insert(userCategories)
    .values({ userId: auth.dbUser.id, scope, name, color, icon, updatedAt: new Date() })
    .returning();

  return NextResponse.json({ category }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = Number((body as Record<string, unknown> | null)?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Valid category id is required" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  const scope = normalizeCategoryScope((body as Record<string, unknown> | null)?.scope);
  const name = text((body as Record<string, unknown> | null)?.name);
  const color = text((body as Record<string, unknown> | null)?.color);
  const icon = text((body as Record<string, unknown> | null)?.icon);

  if (scope) patch.scope = scope;
  if (name) patch.name = name;
  if (color) patch.color = color;
  if (icon) patch.icon = icon;

  const [category] = await db
    .update(userCategories)
    .set(patch)
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, auth.dbUser.id)))
    .returning();

  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  return NextResponse.json({ category });
}

export async function DELETE(request: Request) {
  const auth = await requireDashboardAuth();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const id = Number((body as Record<string, unknown> | null)?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Valid category id is required" }, { status: 400 });
  }

  const [category] = await db
    .delete(userCategories)
    .where(and(eq(userCategories.id, id), eq(userCategories.userId, auth.dbUser.id)))
    .returning();

  if (!category) return NextResponse.json({ error: "Category not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
