import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini API client gracefully
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
  let lowestNote = "";
  let highestNote = "";
  let lowestFreq: number | undefined;
  let highestFreq: number | undefined;
  let estimatedKey = "";
  let inKeyPercentage = 0;

  try {
    const body = await req.json();
    lowestNote = body.lowestNote || "";
    highestNote = body.highestNote || "";
    lowestFreq = body.lowestFreq;
    highestFreq = body.highestFreq;
    estimatedKey = body.estimatedKey || "";
    inKeyPercentage = body.inKeyPercentage || 0;

    const ai = getGeminiClient();

    const promptText = `
      Act as an expert vocal coach. Analyze the user's singing session results:
      - Low Note Hit: ${lowestNote} (${lowestFreq ? lowestFreq.toFixed(1) : 'unknown'} Hz)
      - High Note Hit: ${highestNote} (${highestFreq ? highestFreq.toFixed(1) : 'unknown'} Hz)
      - Active Estimated Song Key: ${estimatedKey || "Unknown Key"}
      - Scale Harmony Alignment: ${inKeyPercentage}% of sung notes were inside the correct scale.

      Provide a customized coaching response in JSON containing:
      1. classification: Vocal classification (e.g., Bass, Baritone, Tenor, Contralto, Mezzo-Soprano, Soprano) based on low/high note frequencies.
      2. keyHarmonyFeedback: Clear coaching of their alignment (${inKeyPercentage}%) to the typical melodic range of the song key (${estimatedKey}). Explain why staying in typical notes keeps vocal melody sweet and balanced.
      3. lowerAdvice: Technical steps to safely extend below ${lowestNote} without straining.
      4. upperAdvice: Technical steps to sing higher than ${highestNote} using head resonance, mixing registers, and breath support.
      5. exercises: exactly 3 actionable, highly professional vocal training drills with recommended durations.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptText,
      config: {
        systemInstruction: "You are an inspiring and highly technical vocal coach. Keep explanations actionable, encouraging, and structured using precise vocal science terminology (tessitura, head voice, chest voice, passage, mixed register). Keep each string compact and high-density.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            keyHarmonyFeedback: { type: Type.STRING },
            lowerAdvice: { type: Type.STRING },
            upperAdvice: { type: Type.STRING },
            exercises: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "List of 3 actionable vocal drills."
            }
          },
          required: ["classification", "keyHarmonyFeedback", "lowerAdvice", "upperAdvice", "exercises"]
        }
      }
    });

    const responseText = response.text;
    if (!responseText) {
      throw new Error("No response from Gemini");
    }

    return NextResponse.json(JSON.parse(responseText.trim()));
  } catch (error: any) {
    console.error("Gemini API Error in /api/range:", error);
    // Highly polished fallback response
    return NextResponse.json({
      classification: "Determining...",
      keyHarmonyFeedback: `Your scale alignment was tracked. Staying within the typical notes of ${estimatedKey || "the estimated scale"} creates a beautifully grounded and harmonic vocal delivery.`,
      lowerAdvice: `To sing lower than ${lowestNote || "your lowest note"} safely, relax your tongue, drop your larynx gently (like a soft yawn), and avoid compressing your throat.`,
      upperAdvice: `To expand higher than ${highestNote || "your highest note"}, focus on utilizing your mixed and head registers. Soften your vowel placement, lean into forward resonance (face mask), and push breath from your core.`,
      exercises: [
        "Lip Trill Sirens (3 mins): Glide gently from your low register to high register on relaxed lips.",
        "Octave Arpeggio Hum (2 mins): Practice scale degrees on a resonant 'mmm' to stretch the chords.",
        "Light Vowel Slides (3 mins): Slide upward on a soft 'Ooo' sound, releasing head voice tension."
      ]
    });
  }
}
