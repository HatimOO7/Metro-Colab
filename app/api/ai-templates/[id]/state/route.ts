import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTemplates, aiTemplateStates } from "@/db/schema";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import type { AppState } from "@/db/schema";

// ── Auth helper ───────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

// ── GET /api/ai-templates/[id]/state ─────────────────────────────────────────
// Fetches the current appState for a template. If no persisted state exists,
// falls back to the template's `initialState`. Ensures the caller owns the template.

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const templateId = Number(id);
  if (!templateId || isNaN(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }

  try {
    // Fetch persisted state and template in a single round-trip
    const [stateRecord] = await db
      .select()
      .from(aiTemplateStates)
      .where(
        and(
          eq(aiTemplateStates.userId, user.id),
          eq(aiTemplateStates.templateId, templateId)
        )
      )
      .limit(1);

    // If a non-empty state exists, return it merged on top of initialState
    if (stateRecord && Object.keys(stateRecord.appState).length > 0) {
      // Also fetch initialState to merge — ensure schema keys are present even
      // if the user's saved state predates a template update.
      const [template] = await db
        .select({ initialState: aiTemplates.appJson })
        .from(aiTemplates)
        .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, user.id)))
        .limit(1);

      if (!template) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }

      // template.initialState is the aliased appJson column value
      const appJson = template.initialState as { initialState?: AppState };
      const baseState: AppState = (appJson?.initialState as AppState) ?? {};
      // Merge: initialState provides defaults, saved state takes precedence
      const merged: AppState = { ...baseState, ...stateRecord.appState };
      return NextResponse.json({ appState: merged }, { status: 200 });
    }



    // No persisted state — fetch template and return its initialState as default
    const [template] = await db
      .select()
      .from(aiTemplates)
      .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const fallbackState: AppState = (template.appJson.initialState as AppState) ?? {};
    return NextResponse.json({ appState: fallbackState }, { status: 200 });
  } catch (err) {
    console.error(`[GET /api/ai-templates/${templateId}/state] Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── PUT /api/ai-templates/[id]/state ─────────────────────────────────────────
// Saves/updates the appState for a template. Uses PostgreSQL UPSERT
// (INSERT ... ON CONFLICT DO UPDATE) to guarantee atomicity — no lost updates
// even under concurrent high-frequency requests from the debounce logic.
//
// The frontend already handles race conditions via AbortController + debounce,
// so by the time a request reaches here, it is always the latest desired state.

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await props.params;
  const templateId = Number(id);
  if (!templateId || isNaN(templateId) || templateId <= 0) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }

  // Parse body safely
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { appState } = body as { appState?: unknown };
  if (!appState || typeof appState !== "object" || Array.isArray(appState)) {
    return NextResponse.json(
      { error: "appState must be a non-null, non-array JSON object" },
      { status: 400 }
    );
  }

  // Verify the template belongs to this user before saving state
  try {
    const [template] = await db
      .select({ id: aiTemplates.id })
      .from(aiTemplates)
      .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    // Atomic upsert — safe under concurrent requests.
    // If a row doesn't exist, INSERT it. If it does, UPDATE in place.
    await db
      .insert(aiTemplateStates)
      .values({
        userId: user.id,
        templateId,
        appState: appState as AppState,
      })
      .onConflictDoUpdate({
        target: [aiTemplateStates.userId, aiTemplateStates.templateId],
        set: {
          appState: appState as AppState,
          updatedAt: sql`now()`,
        },
      });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error(`[PUT /api/ai-templates/${templateId}/state] Error:`, err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
