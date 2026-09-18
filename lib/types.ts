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

export type RiskSeverity = 'none' | 'low' | 'medium' | 'high';
export type VerificationStatus = 'verified' | 'needs_review';

export interface ClauseAnalysis {
  clauseId: string;
  explanation: string;
  risk: {
    severity: RiskSeverity;
    reason: string;
  };
  verification: {
    status: VerificationStatus;
    lexicalPassed: boolean;
    llmJudgePassed: boolean;
    confidence: number;
    details?: string;
  };
}

export interface AnalyzedClause extends Clause {
  analysis: ClauseAnalysis;
}

export interface SimplifyApiResponse {
  status: 'success' | 'error';
  data?: {
    documentId?: string;
    analyzedClauses: AnalyzedClause[];
    summary: {
      totalClauses: number;
      verifiedCount: number;
      needsReviewCount: number;
      highRiskCount: number;
    };
  };
  message?: string;
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
