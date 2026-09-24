/**
 * Consolidated Gemini Model Cascades for NyayaLens.
 *
 * Standardizes model references across all API routes, background workers,
 * and deterministic verification judges.
 */

/**
 * 1. Default Generation & Dual-Gate Verification Cascade
 *
 * Used across:
 * - /api/healthcheck (API liveness probe)
 * - /api/parse (Multimodal PDF/image document segmentation)
 * - /api/simplify (Plain-language translation & risk assessment)
 * - /api/compare (Semantic clause alignment & substantive diffing)
 * - /api/checklist (Pre-signing action checklist & advocate inquiry generation)
 * - lib/verify.ts (Gate 2 impartial LLM-Judge verification)
 *
 * Ordered by reliability, cost efficiency, and structured output adherence.
 */
export const DEFAULT_MODEL_CASCADE: string[] = Array.from(
  new Set([
    process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ])
).filter(Boolean) as string[];

/**
 * 2. Chat Streaming Cascade (Deliberate Exception)
 *
 * Used across:
 * - /api/chat (Real-time SSE token streaming over retrieved clauses)
 *
 * Exception rationale:
 * Chat streaming is strictly latency-sensitive. Users expect near-instantaneous
 * Time-To-First-Token (TTFT) when asking natural language questions. We prioritize
 * ultra-low latency flash-lite models before broader fallback models.
 */
export const CHAT_STREAMING_MODELS: string[] = Array.from(
  new Set([
    process.env.GEMINI_CHAT_MODEL || process.env.GEMINI_MODEL,
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
    'gemini-3.6-flash',
  ])
).filter(Boolean) as string[];

/**
 * 3. Dense Vector Embedding Cascade
 *
 * Used across:
 * - lib/retrieval.ts (Embedding clauses for cosine similarity search in Chat & Compare)
 */
export const EMBEDDING_MODELS: string[] = [
  'gemini-embedding-001',
  'gemini-embedding-2',
  'gemini-embedding-2-preview',
];
