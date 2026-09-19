import { getGeminiClient } from '@/lib/gemini';
import { Clause, ClauseEmbedding, RelevantClauseMatch } from '@/lib/types';

const EMBEDDING_MODELS = [
  'gemini-embedding-001',
  'gemini-embedding-2',
  'gemini-embedding-2-preview',
];

/**
 * Calculates cosine similarity between two numerical vectors.
 * Pure local computation with zero external API calls.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Embeds all clauses of a document in a single batched API call.
 * Uses Gemini embeddings API (gemini-embedding-001) with fallback.
 */
export async function embedAllClauses(clauses: Clause[]): Promise<ClauseEmbedding[]> {
  if (!clauses || clauses.length === 0) return [];

  const clauseTexts = clauses.map((c) =>
    `${c.sectionNumber || ''} ${c.heading || ''}: ${c.rawText}`.trim()
  );

  const ai = getGeminiClient();
  let lastError: Error | null = null;

  for (const model of EMBEDDING_MODELS) {
    try {
      const response = await ai.models.embedContent({
        model,
        contents: clauseTexts,
      });

      const resp = response as unknown as {
        embedding?: { values?: number[] };
        embeddings?: Array<{ values?: number[] }>;
      };

      if (resp.embeddings && resp.embeddings.length === clauses.length) {
        return clauses.map((c, index) => ({
          clauseId: c.id,
          embedding: resp.embeddings![index].values || [],
        }));
      } else if (resp.embedding && clauses.length === 1) {
        return [
          {
            clauseId: clauses[0].id,
            embedding: resp.embedding.values || [],
          },
        ];
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error('Failed to embed clauses across all candidate embedding models.');
}

/**
 * Embeds a single question query string.
 */
export async function embedQuestion(question: string): Promise<number[]> {
  const ai = getGeminiClient();
  let lastError: Error | null = null;

  for (const model of EMBEDDING_MODELS) {
    try {
      const response = await ai.models.embedContent({
        model,
        contents: question,
      });

      const resp = response as unknown as {
        embedding?: { values?: number[] };
        embeddings?: Array<{ values?: number[] }>;
      };

      if (resp.embedding?.values) {
        return resp.embedding.values;
      }
      if (resp.embeddings && resp.embeddings.length > 0 && resp.embeddings[0].values) {
        return resp.embeddings[0].values;
      }
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      continue;
    }
  }

  throw lastError || new Error('Failed to embed question across all candidate embedding models.');
}

/**
 * Retrieves the top-K most relevant clauses for a user question.
 * Embeds the question and computes local cosine similarity against cached clause embeddings.
 */
export async function findRelevantClauses(
  question: string,
  clauseEmbeddings: ClauseEmbedding[],
  clauses: Clause[],
  topK = 5
): Promise<RelevantClauseMatch[]> {
  if (!question.trim() || !clauses || clauses.length === 0) {
    return [];
  }

  const clauseMap = new Map<string, Clause>(clauses.map((c) => [c.id, c]));

  // If no embeddings provided or missing for some clauses, compute them
  let validEmbeddings = clauseEmbeddings;
  if (!validEmbeddings || validEmbeddings.length < clauses.length) {
    validEmbeddings = await embedAllClauses(clauses);
  }

  // 1. Embed question query (1 API call)
  const questionEmbedding = await embedQuestion(question);

  // 2. Pure local cosine similarity calculation
  const matches: RelevantClauseMatch[] = [];

  for (const item of validEmbeddings) {
    const clause = clauseMap.get(item.clauseId);
    if (!clause) continue;

    const similarity = cosineSimilarity(questionEmbedding, item.embedding);
    matches.push({ clause, similarity });
  }

  // 3. Sort descending by similarity
  matches.sort((a, b) => b.similarity - a.similarity);

  return matches.slice(0, topK);
}
