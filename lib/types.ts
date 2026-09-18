/**
 * Core data models for NyayaLens.
 * Aligned with product specifications in CONTEXT.md.
 */

export type ClauseCategory =
  | 'Payment'
  | 'Termination'
  | 'Liability'
  | 'Deposit'
  | 'Notice'
  | 'Other';

export interface Clause {
  id: string;
  sectionNumber?: string;
  heading?: string;
  rawText: string;
  category: ClauseCategory | string;
}

export interface ParsedDocument {
  id: string;
  filename: string;
  uploadedAt: string;
  clauses: Clause[];
}

export interface ParseApiResponse {
  status: 'success' | 'error';
  data?: ParsedDocument;
  message?: string;
  code?: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'SCHEMA_MISMATCH' | 'EMPTY_DOCUMENT' | 'API_ERROR';
}

export interface HealthcheckResponse {
  status: 'ok' | 'error';
  text?: string;
  message?: string;
  model?: string;
}
