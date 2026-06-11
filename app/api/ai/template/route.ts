import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { createAiTemplate } from "@/lib/ai-templates";
import { db } from "@/db";
import { aiTemplateRecords } from "@/db/schema";
import type { AiTemplateJson } from "@/db/schema";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an AI mini-app schema generator. Given a user prompt, output ONLY valid JSON (no markdown block, no markdown, no explanations) matching this exact schema:

{
  "appName": "string — short name of the app",
  "description": "string — 1-2 sentence description",
  "icon": "string — Lucide icon name, e.g. Flame, Target, Apple, BookOpen, DollarSign, Heart, Star, Zap, Coffee, Music, Camera, Globe, Briefcase, Clock, Trophy, Leaf, Moon, Sun, Activity, CheckSquare",
  "color": "string — hex color code for the app theme",
  "entities": [
    {
      "name": "string — entity key (plural lowercase, e.g. 'tasks', 'habits')",
      "label": "string — human-friendly label (singular, e.g. 'Task', 'Habit')",
      "fields": [
        {
          "name": "string — field key (camelCase, e.g. 'title', 'dueDate', 'amount')",
          "label": "string — human-friendly field label",
          "type": "text | number | date | select | boolean | textarea",
          "required": true | false,
          "options": ["string"] // only when type is 'select'
        }
      ]
    }
  ],
  "forms": [
    {
      "id": "string — unique form ID",
      "title": "string — form title",
      "entity": "string — target entity name (plural lowercase)",
      "fields": [
        {
          "name": "string — name of entity field",
          "label": "string — field label override if any",
          "type": "text | number | date | select | boolean | textarea",
          "placeholder": "string — input placeholder",
          "required": true | false
        }
      ]
    }
  ],
  "widgets": [
    {
      "id": "string — unique widget ID",
      "type": "stats | progress | list | table",
      "title": "string — widget title",
      "entity": "string — target entity name (plural lowercase)",
      // for stats widgets:
      "items": [
        {
          "label": "string — label of statistic",
          "valueType": "count | sum | avg | max | min",
          "field": "string — field name to calculate on (optional, required if sum/avg/max/min)",
          "filter": { "field": "value" } // optional filter condition
        }
      ],
      // for progress widgets:
      "calculate": "percentage | sum_target",
      "targetField": "string — field to sum/check (optional)",
      "filterField": "string — boolean field name to filter on for completion percentage (optional)",
      "targetValue": 100, // optional target number for progress calculations
      // for list/table widgets:
      "searchable": true | false,
      "filterable": true | false,
      "filterFields": ["string — field names to filter on"],
      "displayFields": ["string — field names to display in columns/list"],
      "actions": ["string — action IDs from actions array"]
    }
  ],
  "actions": [
    {
      "id": "string — unique action ID",
      "label": "string — label of action button",
      "type": "create | update | delete",
      "entity": "string — target entity name (plural lowercase)",
      "fields": { "field": "value" } // for updates, what field value changes to (e.g. { "completed": "toggle" })
    }
  ],
  "sampleData": {
    "entityName": [
      {
        "field1": "value",
        "field2": 123
      }
    ]
  }
}

CRITICAL RULES:
- Output ONLY valid JSON. Absolutely no explanations, no HTML tags, no markdown blocks (do not wrap in \`\`\`json).
- The JSON must be fully compliant and parseable.
- Generate a fully functional application containing entities, forms, widgets, actions, and realistic sample data (at least 2-3 sample records per entity).
- Ensure all entity names referenced in forms, widgets, and actions match names declared in the entities array.
- For stats and progress widgets, write query details so the dynamic renderer can compute them on the fly from the database records.`;

function stripJson(text: string): string {
  let result = text.trim();
  if (result.startsWith("```")) {
    result = result.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }
  return result;
}

async function generateWithGemini(apiKey: string, prompt: string): Promise<AiTemplateJson> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nUser prompt: ${prompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Gemini API error (${response.status}): ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw || typeof raw !== "string") throw new Error("Gemini returned empty response");

  const parsed = JSON.parse(stripJson(raw)) as AiTemplateJson;

  if (!parsed.appName || !Array.isArray(parsed.entities) || !Array.isArray(parsed.widgets)) {
    throw new Error("Invalid template structure from AI");
  }

  return parsed;
}

function mockTemplate(prompt: string): AiTemplateJson {
  const name = prompt.slice(0, 28) || "Habit Tracker";
  return {
    appName: name,
    description: `A simple ${name.toLowerCase()} app to keep track of your daily routine.`,
    icon: "Flame",
    color: "#F97316",
    entities: [
      {
        name: "habits",
        label: "Habit",
        fields: [
          { name: "name", label: "Habit Name", type: "text", required: true },
          { name: "streak", label: "Streak", type: "number", required: true },
          { name: "completed", label: "Completed Today", type: "boolean", required: true },
          { name: "category", label: "Category", type: "select", options: ["Health", "Mind", "Work"], required: false }
        ]
      }
    ],
    forms: [
      {
        id: "add-habit-form",
        title: "Add New Habit",
        entity: "habits",
        fields: [
          { name: "name", label: "Habit Name", type: "text", placeholder: "e.g. Read for 30 minutes", required: true },
          { name: "category", label: "Category", type: "select", placeholder: "Select category", required: false }
        ]
      }
    ],
    widgets: [
      {
        id: "stats-widget",
        type: "stats",
        title: "Stats",
        entity: "habits",
        items: [
          { label: "Total Habits", valueType: "count" },
          { label: "Completed Habits", valueType: "count", filter: { "completed": true } },
          { label: "Max Streak", valueType: "max", field: "streak" }
        ]
      },
      {
        id: "progress-widget",
        type: "progress",
        title: "Completion Progress",
        entity: "habits",
        calculate: "percentage",
        filterField: "completed"
      },
      {
        id: "list-widget",
        type: "list",
        title: "My Habits",
        entity: "habits",
        searchable: true,
        filterable: true,
        filterFields: ["category"],
        displayFields: ["name", "streak", "completed"],
        actions: ["toggle-complete", "delete"]
      }
    ],
    actions: [
      {
        id: "toggle-complete",
        label: "Toggle Complete",
        type: "update",
        entity: "habits",
        fields: { "completed": "toggle" }
      },
      {
        id: "delete",
        label: "Delete",
        type: "delete",
        entity: "habits"
      }
    ],
    sampleData: {
      "habits": [
        { "name": "Drink Water", "streak": 4, "completed": true, "category": "Health" },
        { "name": "Read Book", "streak": 2, "completed": false, "category": "Mind" },
        { "name": "Refactor Code", "streak": 10, "completed": true, "category": "Work" }
      ]
    }
  };
}

export async function POST(request: Request) {
  const user = await getDatabaseUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.prompt !== "string" || !body.prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const prompt = (body.prompt as string).trim();
    const apiKey = process.env.GEMINI_API_KEY;

    let appJson: AiTemplateJson;
    let simulated = false;

    if (apiKey) {
      try {
        appJson = await generateWithGemini(apiKey, prompt);
      } catch (err) {
        console.error("Gemini template generation failed:", err);
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "AI generation failed" },
          { status: 502 }
        );
      }
    } else {
      appJson = mockTemplate(prompt);
      simulated = true;
    }

    const template = await createAiTemplate(user.id, appJson);

    // Seed sample data in the database
    if (appJson.sampleData) {
      try {
        for (const [entityName, records] of Object.entries(appJson.sampleData)) {
          if (Array.isArray(records)) {
            for (const record of records) {
              await db.insert(aiTemplateRecords).values({
                userId: user.id,
                templateId: template.id,
                entityName,
                data: record as Record<string, unknown>,
              });
            }
          }
        }
      } catch (err) {
        console.error("Failed to seed sample data:", err);
      }
    }

    return NextResponse.json({ template, simulated }, { status: 201 });
  } catch (err) {
    console.error("AI template route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
