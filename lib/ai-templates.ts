import "server-only";

import { and, asc, desc, eq, count } from "drizzle-orm";
import { db, aiTemplates, aiTemplateSidebarPins } from "@/db";
import type { AiTemplateJson } from "@/db/schema";

export const MAX_SIDEBAR_PINS = 3;

// ── Create ────────────────────────────────────────────────────────────────────

export async function createAiTemplate(userId: number, appJson: AiTemplateJson) {
  const [template] = await db
    .insert(aiTemplates)
    .values({
      userId,
      appName: appJson.appName,
      description: appJson.description,
      icon: appJson.icon,
      color: appJson.color,
      appJson,
    })
    .returning();

  if (!template) throw new Error("Failed to create AI template");
  return template;
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAiTemplatesForUser(userId: number) {
  return db
    .select()
    .from(aiTemplates)
    .where(eq(aiTemplates.userId, userId))
    .orderBy(desc(aiTemplates.createdAt));
}

export async function getAiTemplateById(userId: number, templateId: number) {
  const [template] = await db
    .select()
    .from(aiTemplates)
    .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, userId)));

  return template ?? null;
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteAiTemplate(userId: number, templateId: number) {
  // Cascade will auto-remove sidebar pins due to FK onDelete cascade
  const result = await db
    .delete(aiTemplates)
    .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, userId)))
    .returning({ id: aiTemplates.id });

  return result.length > 0;
}

// ── Sidebar Pins ──────────────────────────────────────────────────────────────

export async function getSidebarPins(userId: number) {
  const rows = await db
    .select({
      pin: aiTemplateSidebarPins,
      template: aiTemplates,
    })
    .from(aiTemplateSidebarPins)
    .innerJoin(aiTemplates, eq(aiTemplateSidebarPins.templateId, aiTemplates.id))
    .where(eq(aiTemplateSidebarPins.userId, userId))
    .orderBy(asc(aiTemplateSidebarPins.position));

  return rows.map(({ pin, template }) => ({ ...template, pinId: pin.id, position: pin.position }));
}

export async function addSidebarPin(userId: number, templateId: number) {
  // Enforce max pins
  const [{ pinCount }] = await db
    .select({ pinCount: count() })
    .from(aiTemplateSidebarPins)
    .where(eq(aiTemplateSidebarPins.userId, userId));

  if (pinCount >= MAX_SIDEBAR_PINS) {
    return { error: `Maximum ${MAX_SIDEBAR_PINS} apps can be pinned to the sidebar` };
  }

  // Check template belongs to user
  const [template] = await db
    .select()
    .from(aiTemplates)
    .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, userId)));

  if (!template) return { error: "Template not found" };

  // Already pinned?
  const [existing] = await db
    .select()
    .from(aiTemplateSidebarPins)
    .where(
      and(eq(aiTemplateSidebarPins.userId, userId), eq(aiTemplateSidebarPins.templateId, templateId))
    );

  if (existing) return { error: "Already pinned" };

  const [pin] = await db
    .insert(aiTemplateSidebarPins)
    .values({ userId, templateId, position: pinCount })
    .returning();

  return { pin };
}

export async function removeSidebarPin(userId: number, templateId: number) {
  const result = await db
    .delete(aiTemplateSidebarPins)
    .where(
      and(eq(aiTemplateSidebarPins.userId, userId), eq(aiTemplateSidebarPins.templateId, templateId))
    )
    .returning({ id: aiTemplateSidebarPins.id });

  return result.length > 0;
}
