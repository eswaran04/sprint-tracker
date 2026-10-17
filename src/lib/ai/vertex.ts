import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Vertex AI access through Application Default Credentials: the App Hosting runtime service account in production,
 * `gcloud auth application-default login` locally. No API keys.
 */

let client: GoogleGenAI | null = null;

/** False when AI_ENABLED=false (CI, offline dev) or the project isn't configured. */
export function isAiEnabled() {
  return process.env.AI_ENABLED !== "false" && Boolean(process.env.GOOGLE_CLOUD_PROJECT);
}

export function vertex(): GoogleGenAI {
  if (!isAiEnabled()) throw new Error("Vertex AI is disabled");
  client ??= new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "global",
  });
  return client;
}

export const filtersModel = () => process.env.AI_FILTERS_MODEL || "gemini-2.5-flash-lite";
export const embedModel = () => process.env.AI_EMBED_MODEL || "gemini-embedding-001";
export const embedDimensions = () => Number(process.env.AI_EMBED_DIMENSIONS) || 768;
