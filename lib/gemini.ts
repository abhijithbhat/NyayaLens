import { GoogleGenAI } from '@google/genai';

let client: GoogleGenAI | null = null;

/**
 * Returns a cached instance of GoogleGenAI initialized with GEMINI_API_KEY.
 * Never hardcodes an API key; strictly reads from environment variables.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set in environment variables');
  }

  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }

  return client;
}
