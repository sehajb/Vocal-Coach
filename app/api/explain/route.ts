import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Ensure Gemini API client is initialized gracefully
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not defined");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      key,
      alternateKey,
      mode,
      progressionStyle,
      progressionChords,
      complexity,
    } = body;

    const ai = getGeminiClient();

    const promptText = `
      Analyze this musical scale and chord progression for a beginner singer/guitarist:
      - Detected Key: ${key} (Alternate/Relative guess: ${alternateKey})
      - Mode: ${mode}
      - Progression Style Selected: ${progressionStyle}
      - Chords used: ${progressionChords ? progressionChords.join(", ") : "None"}
      - Complexity: ${complexity}

      Provide:
      1. A simplified, warm explanation of what this key means for a singer and player (e.g. vocal range expectation, overall mood). This key is in ${mode} mode. Mention the root note and why it feels like "home".
      2. Analyze the roles of each of these chords: [${progressionChords ? progressionChords.join(", ") : ""}] within the scale degrees (such as tonic, subdominant, dominant, or borrow chords) and why they sound good together.
      3. For songs of Indian, Hindi, Punjabi, or Bollywood heritage, explain how this key or chord progression relates to that flavor. Mention typical moods this progression creates in Bollywood music (e.g., romantic, soulful, melancholic, upbeat) and suggest 1 or 2 famous songs that might use a similar sound or vibe.
      4. List 3 simple, practical practicing tips (such as vocal warmup tips, guitar picking, or hand transitions).
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "You are an encouraging vocal coach, guitar instructor, and expert in Bollywood and global popular music theory. Keep explanations simple, engaging, and structured.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            explanation: {
              type: Type.STRING,
              description: "A friendly, simple explanation of the key and its visual/vocal vibe.",
            },
            chordRoles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  chord: { type: Type.STRING, description: "The chord name, e.g. Am" },
                  role: { type: Type.STRING, description: "The theoretical role (e.g., Tonic, Subdominant, Flat VI)" },
                  explanation: { type: Type.STRING, description: "Why this chord adds to the mood of the progression." },
                },
                required: ["chord", "role", "explanation"],
              },
              description: "Theoretical roles and descriptions for the chords.",
            },
            bollywoodConnections: {
              type: Type.STRING,
              description: "High-value connection to Bollywood melodies, scales, Punjabi moods, or hits.",
            },
            practiceTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Three helpful, structured practice bullet points.",
            },
          },
          required: ["explanation", "chordRoles", "bollywoodConnections", "practiceTips"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response text returned from Gemini");
    }

    const data = JSON.parse(responseText.trim());
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Gemini API Error in /api/explain:", error);
    return NextResponse.json(
      {
        error: error.message || "Failed to generate explanation",
        explanation: "Our AI Vocal & Guitar Coach is temporarily tuning. Please try explaining again in a moment!",
        chordRoles: [],
        bollywoodConnections: "Bollywood music is filled with expressive major and minor transitions. Major scales usually bring romantic or festive vibes, while minor scales outline soulful, melancholic, or highly rhythmic Punajbi pop structures.",
        practiceTips: [
          "Hum the root note softly before playing chords to align your vocal placement.",
          "Practice changing between chords slowly using a steady, basic down-strum.",
          "Use a capo to sing comfortably if the current key is outside your optimal vocal range."
        ]
      },
      { status: 500 }
    );
  }
}
