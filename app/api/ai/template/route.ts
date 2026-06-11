import { NextResponse } from "next/server";
import { syncCurrentUserToDatabase } from "@/lib/sync-user";
import { createAiTemplate } from "@/lib/ai-templates";
import type { AiTemplateJson } from "@/db/schema";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT = `You are an AI mini-app generator. Given a user prompt, output ONLY valid JSON (no markdown, no explanation) matching this exact schema:

{
  "appName": "string — short title of the app",
  "description": "string — 1-2 sentence description",
  "icon": "string — one of: Flame, Target, Apple, BookOpen, DollarSign, Heart, Star, Zap, Coffee, Music, Camera, Globe, Briefcase, Clock, Trophy, Leaf, Moon, Sun, Activity, CheckSquare",
  "color": "string — hex color like #F97316 that matches the app theme",
  "layout": "single-page",
  "initialState": { "listItems": [{ "id": "1", "label": "Drink Water", "completed": false }] },
  "sections": [
    {
      "id": "unique-section-id",
      "type": "stats | list | table | form | progress | checklist | tags | chart | button",
      "title": "Section Title",
      "data": { ... section-specific data ... },
      "dataSource": "listItems",
      "action": "TOGGLE_ITEM | ADD_ITEM | DELETE_ITEM",
      "target": "listItems"
    }
  ],
  "actions": [
    { "label": "Button label", "variant": "primary | secondary | destructive", "action": "CLEAR_ALL", "target": "listItems" }
  ],
  "sampleData": [{ ... sample records relevant to this app ... }]
}

Section data shapes by type:
- stats: { "items": [{ "label": "...", "value": "...", "icon": "...", "trend": "+5%" }] }
- list: { "items": ["item 1", "item 2", ...] } // can also use dataSource
- table: { "headers": ["Col1", "Col2"], "rows": [["val1", "val2"], ...] }
- form: { "fields": [{ "name": "...", "label": "...", "type": "text|number|date|select", "placeholder": "..." }] }
- progress: { "items": [{ "label": "...", "value": 65, "color": "#F97316" }] }
- checklist: { "items": [{ "id": "1", "label": "...", "checked": false }] } // can also use dataSource
- tags: { "items": [{ "label": "...", "color": "#hex" }] }
- chart: { "title": "...", "type": "bar|line|pie", "placeholder": "Chart visualization" }
- button: { "label": "...", "variant": "primary|secondary" }

CRITICAL RULES FOR INTERACTIVITY:
- Include a robust \`initialState\` object with relevant arrays or objects to make the app interactive.
- When generating a \`form\` section, include \`action: "ADD_ITEM"\` and \`target: "your_array_key"\` so it pushes the new item there. Fields should have a \`name\` property.
- When generating a \`list\` or \`checklist\` section, use \`dataSource: "your_array_key"\` so it binds to the state, and include \`action: "TOGGLE_ITEM"\` if they can be checked off.
- Make sure to give array items unique \`id\` properties.
Generate 3-6 meaningful sections appropriate for the app. Include realistic sample data. Keep all text concise.`;

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

  if (!parsed.appName || !Array.isArray(parsed.sections)) {
    throw new Error("Invalid template structure from AI");
  }

  return parsed;
}

function mockTemplate(prompt: string): AiTemplateJson {
  const name = prompt.slice(0, 28) || "My App";
  return {
    appName: name,
    description: `A simple ${name.toLowerCase()} to help you stay organized and productive.`,
    icon: "Target",
    color: "#6366F1",
    layout: "single-page",
    initialState: {
      tasks: [
        { id: "t1", label: "Morning routine", checked: true },
        { id: "t2", label: "Review goals", checked: false },
        { id: "t3", label: "Evening check-in", checked: false },
      ]
    },
    sections: [
      {
        id: "stats-1",
        type: "stats",
        title: "Overview",
        data: {
          items: [
            { label: "Total Items", value: "12", icon: "CheckSquare", trend: "+3 today" },
            { label: "Completed", value: "8", icon: "Trophy", trend: "67%" },
            { label: "Streak", value: "5 days", icon: "Flame", trend: "🔥" },
          ],
        },
      },
      {
        id: "form-1",
        type: "form",
        title: "Add New Task",
        action: "ADD_ITEM",
        target: "tasks",
        data: {
          fields: [
            { name: "label", label: "Task Description", type: "text", placeholder: "What needs to be done?" }
          ]
        }
      },
      {
        id: "checklist-1",
        type: "checklist",
        title: "Today's Tasks",
        dataSource: "tasks",
        action: "TOGGLE_ITEM",
        target: "tasks",
        data: {
          items: [] // Populated by engine
        },
      },
      {
        id: "progress-1",
        type: "progress",
        title: "Weekly Progress",
        data: {
          items: [
            { label: "Goal A", value: 75, color: "#6366F1" },
            { label: "Goal B", value: 40, color: "#F97316" },
            { label: "Goal C", value: 90, color: "#10B981" },
          ],
        },
      },
    ],
    actions: [
      { label: "Add New", variant: "primary" },
      { label: "Export", variant: "secondary" },
    ],
    sampleData: [
      { id: 1, name: "Sample Item 1", status: "active", createdAt: new Date().toISOString() },
      { id: 2, name: "Sample Item 2", status: "done", createdAt: new Date().toISOString() },
    ],
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
    return NextResponse.json({ template, simulated }, { status: 201 });
  } catch (err) {
    console.error("AI template route error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
