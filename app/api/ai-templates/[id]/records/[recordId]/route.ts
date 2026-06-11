import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiTemplates, aiTemplateRecords } from "@/db/schema";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getAuthenticatedUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string; recordId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recordId } = await props.params;
  const templateId = Number(id);
  const numericRecordId = Number(recordId);

  if (!templateId || isNaN(templateId) || !numericRecordId || isNaN(numericRecordId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const [template] = await db
      .select({ appJson: aiTemplates.appJson })
      .from(aiTemplates)
      .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const [existingRecord] = await db
      .select()
      .from(aiTemplateRecords)
      .where(
        and(
          eq(aiTemplateRecords.id, numericRecordId),
          eq(aiTemplateRecords.templateId, templateId),
          eq(aiTemplateRecords.userId, user.id)
        )
      )
      .limit(1);

    if (!existingRecord) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.data !== "object" || Array.isArray(body.data)) {
      return NextResponse.json({ error: "data object is required" }, { status: 400 });
    }

    const { data } = body as { data: Record<string, unknown> };

    const entitySchema = template.appJson.entities?.find((e) => e.name === existingRecord.entityName);
    if (!entitySchema) {
      return NextResponse.json({ error: "Entity definition not found in app schema" }, { status: 500 });
    }

    const mergedData = { ...existingRecord.data, ...data };
    const validatedData: Record<string, unknown> = {};

    for (const field of entitySchema.fields) {
      let value = mergedData[field.name];

      if (field.required && (value === undefined || value === null || value === "")) {
        return NextResponse.json({ error: `Field "${field.label || field.name}" is required` }, { status: 400 });
      }

      if (value !== undefined && value !== null && value !== "") {
        if (field.type === "number") {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            return NextResponse.json({ error: `Field "${field.label || field.name}" must be a number` }, { status: 400 });
          }
          value = numValue;

          if (field.validation) {
            if (field.validation.min !== undefined && numValue < field.validation.min) {
              return NextResponse.json({ error: `Field "${field.label || field.name}" must be at least ${field.validation.min}` }, { status: 400 });
            }
            if (field.validation.max !== undefined && numValue > field.validation.max) {
              return NextResponse.json({ error: `Field "${field.label || field.name}" must be at most ${field.validation.max}` }, { status: 400 });
            }
          }
        } else if (field.type === "boolean") {
          value = Boolean(value);
        } else {
          const strVal = String(value);
          value = strVal;

          if (field.validation) {
            if (field.validation.minLength !== undefined && strVal.length < field.validation.minLength) {
              return NextResponse.json({ error: `Field "${field.label || field.name}" must be at least ${field.validation.minLength} characters` }, { status: 400 });
            }
            if (field.validation.maxLength !== undefined && strVal.length > field.validation.maxLength) {
              return NextResponse.json({ error: `Field "${field.label || field.name}" must be at most ${field.validation.maxLength} characters` }, { status: 400 });
            }
          }
        }
      } else {
        if (field.type === "boolean") {
          value = false;
        } else {
          value = null;
        }
      }

      validatedData[field.name] = value;
    }

    const [updated] = await db
      .update(aiTemplateRecords)
      .set({
        data: validatedData,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(aiTemplateRecords.id, numericRecordId),
          eq(aiTemplateRecords.templateId, templateId),
          eq(aiTemplateRecords.userId, user.id)
        )
      )
      .returning();

    return NextResponse.json({
      record: {
        id: updated.id,
        ...updated.data,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }
    }, { status: 200 });

  } catch (err) {
    console.error("PUT record error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ id: string; recordId: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recordId } = await props.params;
  const templateId = Number(id);
  const numericRecordId = Number(recordId);

  if (!templateId || isNaN(templateId) || !numericRecordId || isNaN(numericRecordId)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  try {
    const result = await db
      .delete(aiTemplateRecords)
      .where(
        and(
          eq(aiTemplateRecords.id, numericRecordId),
          eq(aiTemplateRecords.templateId, templateId),
          eq(aiTemplateRecords.userId, user.id)
        )
      )
      .returning({ id: aiTemplateRecords.id });

    if (result.length === 0) {
      return NextResponse.json({ error: "Record not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("DELETE record error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
