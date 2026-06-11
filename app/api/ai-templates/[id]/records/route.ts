import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
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

export async function GET(
  _request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const templateId = Number(id);
  if (!templateId || isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
  }

  try {
    const [template] = await db
      .select({ id: aiTemplates.id })
      .from(aiTemplates)
      .where(and(eq(aiTemplates.id, templateId), eq(aiTemplates.userId, user.id)))
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const records = await db
      .select()
      .from(aiTemplateRecords)
      .where(
        and(
          eq(aiTemplateRecords.userId, user.id),
          eq(aiTemplateRecords.templateId, templateId)
        )
      );

    const grouped: Record<string, unknown[]> = {};
    for (const record of records) {
      if (!grouped[record.entityName]) {
        grouped[record.entityName] = [];
      }
      grouped[record.entityName].push({
        id: record.id,
        ...record.data,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      });
    }

    return NextResponse.json({ records: grouped }, { status: 200 });
  } catch (err) {
    console.error("GET records error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await props.params;
  const templateId = Number(id);
  if (!templateId || isNaN(templateId)) {
    return NextResponse.json({ error: "Invalid template ID" }, { status: 400 });
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

    const body = await request.json().catch(() => null);
    if (!body || typeof body.entityName !== "string" || typeof body.data !== "object" || Array.isArray(body.data)) {
      return NextResponse.json({ error: "entityName and data object are required" }, { status: 400 });
    }

    const { entityName, data } = body as { entityName: string; data: Record<string, unknown> };

    const entitySchema = template.appJson.entities?.find((e) => e.name === entityName);
    if (!entitySchema) {
      return NextResponse.json({ error: `Entity "${entityName}" not defined in app schema` }, { status: 400 });
    }

    const validatedData: Record<string, unknown> = {};
    for (const field of entitySchema.fields) {
      let value = data[field.name];

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
        // Safe default for booleans if not provided
        if (field.type === "boolean") {
          value = false;
        } else {
          value = null;
        }
      }

      validatedData[field.name] = value;
    }

    const [inserted] = await db
      .insert(aiTemplateRecords)
      .values({
        userId: user.id,
        templateId,
        entityName,
        data: validatedData,
      })
      .returning();

    return NextResponse.json({
      record: {
        id: inserted.id,
        ...inserted.data,
        createdAt: inserted.createdAt,
        updatedAt: inserted.updatedAt,
      }
    }, { status: 201 });

  } catch (err) {
    console.error("POST record error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
