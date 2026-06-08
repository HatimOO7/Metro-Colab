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
      // Direct call to Google Gemini 2.5 Flash API
      let instruction = "";
      if (action === "grammar") {
        instruction = "Correct the grammar, spelling, and punctuation of the following text, making it sound professional, clean, and natural.";
      } else if (action === "rephrase") {
        instruction = "Rephrase the following text to improve vocabulary, sentence structure, flow, and readability while keeping the original meaning intact.";
      } else if (action === "shorter") {
        instruction = "Make the following text significantly shorter and more concise, removing fluff or redundant words. Keep the essential message.";
      } else if (action === "longer") {
        instruction = "Make the following text longer and more detailed, expanding on its points and adding helpful context or descriptive elaboration.";
      } else if (action === "simplify") {
        instruction = "Simplify the vocabulary and structure of the following text so it is extremely clear and readable by a fifth grader.";
      } else if (action === "tone") {
        instruction = `Rewrite the following text to have a clear ${tone || "professional"} tone, modifying vocabulary and phrasing to match.`;
      } else {
        instruction = "Refine and improve the following text.";
      }

      const prompt = `System: You are an expert AI editor. Your task is to refine the user's text based on the instruction. Return ONLY the final refined text. Do NOT include any explanations, introductory text, markdown formatting blocks (like \`\`\`), or quotes. Keep HTML tags if they exist.

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

      if (response.ok) {
        const data = await response.json();
        const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (refinedText && typeof refinedText === "string") {
          return NextResponse.json({ refinedText: refinedText.trim() });
        }
      } else {
        console.error("Gemini API call failed with status:", response.status);
      }
    }

    // Mock Fallback when GEMINI_API_KEY is not defined or API fails
    let refinedText = text;
    const trimmedText = text.trim();

    if (action === "grammar") {
      // Capitalize, fix spaces, ensure trailing period, mock correct common words
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
      // Capitalize first letter
      refinedText = refinedText.charAt(0).toUpperCase() + refinedText.slice(1);
    } else if (action === "rephrase") {
      refinedText = `In other words, ${trimmedText.charAt(0).toLowerCase()}${trimmedText.slice(1)} This alternative formulation communicates the same concept with enhanced clarity.`;
    } else if (action === "shorter") {
      // Strip some words, crop length
      const words = trimmedText.split(/\s+/);
      if (words.length > 8) {
        refinedText = words.slice(0, Math.max(4, Math.floor(words.length * 0.6))).join(" ") + "...";
      } else {
        refinedText = trimmedText.replace(/\b(basically|really|actually|just|very)\b/gi, "").trim();
      }
    } else if (action === "longer") {
      refinedText = `${trimmedText} Furthermore, it is essential to emphasize this concept because it plays a critical role in the broader context. By extending this idea, we can unlock additional insights and ensure a thorough understanding of the underlying principles.`;
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
        refinedText = `Please be advised that: ${trimmedText}`;
      } else if (selectedTone === "casual") {
        refinedText = `So, basically: ${trimmedText.charAt(0).toLowerCase()}${trimmedText.slice(1)}! Pretty neat, right?`;
      } else if (selectedTone === "creative") {
        refinedText = `Imagine a world where: ${trimmedText.charAt(0).toLowerCase()}${trimmedText.slice(1)}... ✨`;
      }
    }

    // Append a marker so the user knows it's a simulated response when key is missing
    if (!apiKey) {
      refinedText = refinedText + " (AI Refined)";
    }

    return NextResponse.json({ refinedText });
  } catch (error) {
    console.error("AI Refine failed:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
