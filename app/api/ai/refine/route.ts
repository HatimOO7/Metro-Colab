import { NextResponse } from "next/server";

import { syncCurrentUserToDatabase } from "@/lib/sync-user";

async function getDatabaseUser() {
  try {
    return await syncCurrentUserToDatabase();
  } catch (error) {
    console.error("Error syncing user:", error);
    return null;
  }
}

const SYSTEM_PROMPT = `You are an expert AI editor. Your task is to refine the user's text based on the instruction. Return ONLY the final refined text. Do NOT include any explanations, introductory text, markdown formatting blocks (like \`\`\`), or quotes. Keep HTML tags if they exist.

CRITICAL: If the user provides an incomplete sentence, a fragment, or a single word, refine it but KEEP it as a fragment. Do NOT force it into a full sentence with a subject and verb unless asked.`;

function buildInstruction(action: string, tone?: string): string {
  switch (action) {
    case "grammar":
      return "Correct the grammar, spelling, and punctuation of the following text, making it sound professional, clean, and natural.";
    case "rephrase":
      return "Rephrase the following text to improve vocabulary, sentence structure, flow, and readability while keeping the original meaning intact.";
    case "shorter":
      return "Make the following text significantly shorter and more concise, removing fluff or redundant words. Keep the essential message.";
    case "longer":
      return "Make the following text longer and more detailed, expanding on its points and adding helpful context or descriptive elaboration.";
    case "simplify":
      return "Simplify the vocabulary and structure of the following text so it is extremely clear and readable by a fifth grader.";
    case "tone":
      return `Rewrite the following text to have a clear ${tone || "professional"} tone, modifying vocabulary and phrasing to match.`;
    default:
      return "Refine and improve the following text.";
  }
}

function stripResponseWrapping(text: string): string {
  let result = text.trim();

  if (
    (result.startsWith('"') && result.endsWith('"')) ||
    (result.startsWith("'") && result.endsWith("'"))
  ) {
    result = result.slice(1, -1).trim();
  }

  if (result.startsWith("```")) {
    result = result.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
  }

  return result;
}

async function refineWithGemini(
  apiKey: string,
  text: string,
  action: string,
  tone?: string
): Promise<string> {
  const instruction = buildInstruction(action, tone);
  const prompt = `${SYSTEM_PROMPT}

Instruction: ${instruction}

Text to refine:
${text}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("Gemini API call failed:", response.status, errorBody);
    throw new Error(`Gemini API error (${response.status})`);
  }

  const data = await response.json();
  const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!refinedText || typeof refinedText !== "string") {
    throw new Error("Gemini returned an empty response");
  }

  return stripResponseWrapping(refinedText);
}

function mockRefine(text: string, action: string, tone?: string): string {
  let refinedText = text;
  const trimmedText = text.trim();

  if (action === "grammar") {
    refinedText = trimmedText
      .replace(/\s+/g, " ")
      .replace(/\b(teh|taht|woudl|dont)\b/gi, (match) => {
        const lower = match.toLowerCase();
        if (lower === "teh") return "the";
        if (lower === "taht") return "that";
        if (lower === "woudl") return "would";
        if (lower === "dont") return "don't";
        return match;
      });
    if (!/[.!?]$/.test(refinedText) && refinedText.length > 0) {
      refinedText += ".";
    }
    refinedText = refinedText.charAt(0).toUpperCase() + refinedText.slice(1);
  } else if (action === "rephrase") {
    refinedText = `In other words, ${trimmedText.charAt(0).toLowerCase()}${trimmedText.slice(1)}`;
  } else if (action === "shorter") {
    const words = trimmedText.split(/\s+/);
    if (words.length > 8) {
      refinedText = words.slice(0, Math.max(4, Math.floor(words.length * 0.6))).join(" ");
    } else {
      refinedText = trimmedText.replace(/\b(basically|really|actually|just|very)\b/gi, "").trim();
    }
  } else if (action === "longer") {
    refinedText = `${trimmedText} — expanded with additional context and detail.`;
  } else if (action === "simplify") {
    refinedText = trimmedText
      .replace(/\b(utilize|facilitate|subsequent|terminate)\b/gi, (match) => {
        const lower = match.toLowerCase();
        if (lower === "utilize") return "use";
        if (lower === "facilitate") return "help";
        if (lower === "subsequent") return "next";
        if (lower === "terminate") return "stop";
        return match;
      })
      .toLowerCase();
    refinedText = refinedText.charAt(0).toUpperCase() + refinedText.slice(1);
  } else if (action === "tone") {
    const selectedTone = tone || "professional";
    if (selectedTone === "professional") {
      refinedText = trimmedText;
    } else if (selectedTone === "casual") {
      refinedText = trimmedText;
    } else if (selectedTone === "creative") {
      refinedText = trimmedText;
    }
  }

  return refinedText;
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

    const { text, action, tone } = body as { text: string; action: string; tone?: string };

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const refinedText = await refineWithGemini(apiKey, text, action, tone);
        return NextResponse.json({ refinedText });
      } catch (error) {
        console.error("Gemini refinement failed:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "AI refinement failed" },
          { status: 502 }
        );
      }
    }

    const refinedText = mockRefine(text, action, tone);
    return NextResponse.json({ refinedText, simulated: true });
  } catch (error) {
    console.error("AI Refine failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
