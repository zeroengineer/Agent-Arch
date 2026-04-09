import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { IngestedFile } from "./ingest";

// ─── Client singleton ──────────────────────────────────────────────────────────
let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set");
    }
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ModuleExplanation {
  summary: string;
  workflow: string[];
}

// ─── Rate-limit helper ─────────────────────────────────────────────────────────
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main export ───────────────────────────────────────────────────────────────
/**
 * Call Gemini 2.0 Flash to explain a code module.
 * Returns structured JSON with a summary and workflow steps.
 * Returns null on any failure to allow the worker to continue without blocking.
 */
export async function explainModule(
  file: IngestedFile,
  imports: string[],
  exports: string[]
): Promise<ModuleExplanation | null> {
  try {
    const client = getClient();

    const model = client.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction:
        "You are a code analysis engine. Analyze the given source code and return a JSON object with exactly two fields: " +
        "summary (string: one paragraph explaining what this module does and its role in the system) and " +
        "workflow (array of 3 to 8 strings, each describing one sequential step of how this module works internally). " +
        "Return only valid JSON.",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            summary: {
              type: SchemaType.STRING,
              description: "One paragraph explaining what this module does and its role in the system",
            },
            workflow: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.STRING,
              },
              description: "3 to 8 sequential steps describing how this module works internally",
            },
          },
          required: ["summary", "workflow"],
        },
        temperature: 0.2,
        maxOutputTokens: 1024,
      },
    });

    // Truncate contents if very long — keep first 6000 chars to stay within token limits
    const truncatedContents =
      file.contents.length > 6000
        ? file.contents.slice(0, 6000) + "\n... [truncated]"
        : file.contents;

    const prompt =
      `Filename: ${file.relativePath}\n` +
      `Language: ${file.language}\n` +
      `Imports: ${imports.join(", ") || "none"}\n` +
      `Exports: ${exports.join(", ") || "none"}\n\n` +
      `Source code:\n${truncatedContents}`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // With responseMimeType: "application/json", Gemini returns clean JSON
    const parsed = JSON.parse(text) as ModuleExplanation;

    // Validate structure
    if (
      typeof parsed.summary !== "string" ||
      !Array.isArray(parsed.workflow) ||
      parsed.workflow.some((s) => typeof s !== "string")
    ) {
      console.warn(`[ai] Unexpected response structure for ${file.relativePath}`);
      return null;
    }

    // Ensure workflow has between 3 and 8 items
    if (parsed.workflow.length < 1) {
      parsed.workflow = ["Module processed successfully."];
    }
    if (parsed.workflow.length > 8) {
      parsed.workflow = parsed.workflow.slice(0, 8);
    }

    // 500ms delay between calls to respect free-tier rate limits
    await delay(500);

    return parsed;
  } catch (err) {
    console.error(`[ai] Failed to explain module ${file.relativePath}:`, err);
    // Add delay even on failure to avoid hammering the API
    await delay(500);
    return null;
  }
}
