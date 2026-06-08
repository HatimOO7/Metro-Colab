import { NextResponse } from "next/server";

import type { DiagramPayload } from "@/lib/excalidraw-diagram";
import { getDatabaseUser } from "@/lib/whiteboard";

const SYSTEM_PROMPT = `You are a diagram generator. Given a user prompt, output ONLY valid JSON (no markdown, no explanation) matching this schema:
{
  "nodes": [{ "id": "unique-string", "label": "Node text", "type": "rectangle" | "diamond" | "ellipse" | "sticky" }],
  "edges": [{ "from": "node-id", "to": "node-id", "label": "optional edge label" }]
}
Rules:
- Use 3-12 nodes for flowcharts, 4-15 for mindmaps.
- For decision points use type "diamond".
- For mindmaps use a central node with radiating connections.
- For sticky-note brainstorms use type "sticky".
- Every edge "from" and "to" must reference existing node ids.
- Keep labels concise (under 40 chars).`;

function stripJson(text: string): string {
  let result = text.trim();

  if (result.startsWith("```")) {
    result = result.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }

  return result;
}

function mockDiagram(prompt: string): DiagramPayload {
  const topic = prompt.slice(0, 24) || "Topic";
  return {
    nodes: [
      { id: "start", label: "Start", type: "ellipse" },
      { id: "main", label: topic, type: "rectangle" },
      { id: "idea1", label: "Idea A", type: "sticky" },
      { id: "idea2", label: "Idea B", type: "sticky" },
      { id: "end", label: "Done", type: "ellipse" },
    ],
    edges: [
      { from: "start", to: "main" },
      { from: "main", to: "idea1", label: "explore" },
      { from: "main", to: "idea2", label: "explore" },
      { from: "idea1", to: "end" },
      { from: "idea2", to: "end" },
    ],
  };
}

async function generateWithGemini(apiKey: string, prompt: string): Promise<DiagramPayload> {
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
          temperature: 0.4,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("Gemini diagram failed:", response.status, errorBody);
    throw new Error(`Gemini API error (${response.status})`);
  }

  const data = await response.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!raw || typeof raw !== "string") {
    throw new Error("Gemini returned an empty response");
  }

  const parsed = JSON.parse(stripJson(raw)) as DiagramPayload;

  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error("Invalid diagram structure from AI");
  }

  return parsed;
}

export async function POST(request: Request) {
  const user = await getDatabaseUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { prompt } = body as { prompt?: string };

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const diagram = await generateWithGemini(apiKey, prompt.trim());
        return NextResponse.json({ diagram });
      } catch (error) {
        console.error("Gemini diagram generation failed:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "AI diagram generation failed" },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({ diagram: mockDiagram(prompt.trim()), simulated: true });
  } catch (error) {
    console.error("AI diagram failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
