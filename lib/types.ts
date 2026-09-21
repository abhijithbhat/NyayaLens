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
      apiCallsCount?: number;
    };
  };
  message?: string;
}

export type DiffParty = 'A' | 'B' | 'neutral';
export type Language = 'en' | 'hi' | 'kn';

export interface ChecklistItem {
  id: string;
  clauseId: string;
  clauseHeading?: string;
  sourceType: 'analysis' | 'comparison';
  severity: RiskSeverity;
  verificationStatus: VerificationStatus;
  checklistAction: string;
  lawyerQuestion?: string;
  completed?: boolean;
}

export interface ChecklistApiResponse {
  status: 'success' | 'error';
  data?: {
    items: ChecklistItem[];
    language: Language;
    generatedAt: string;
    itemCount: number;
    totalItems?: number;
    highRiskCount?: number;
    needsReviewCount?: number;
    apiCallsCount?: number;
  };
  message?: string;
}

export interface MatchedClausePair {
  id: string;
  clauseA: Clause;
  clauseB: Clause;
  difference: string;
  favors: DiffParty;
  favorsReason?: string;
  verification: {
    status: VerificationStatus;
    confidence: number;
    details?: string;
  };
}

export interface UnmatchedClause {
  clause: Clause;
  onlyIn: 'A' | 'B';
}

export interface ComparisonSummary {
  totalClausesA: number;
  totalClausesB: number;
  matchedCount: number;
  unmatchedCountA: number;
  unmatchedCountB: number;
  favorsACount: number;
  favorsBCount: number;
  neutralCount: number;
  apiCallsCount?: number;
}

export interface ComparisonResult {
  id: string;
  documentA: {
    id?: string;
    filename: string;
  };
  documentB: {
    id?: string;
    filename: string;
  };
  comparedAt: string;
  summary: ComparisonSummary;
  matchedPairs: MatchedClausePair[];
  unmatchedClauses: UnmatchedClause[];
}

export interface CompareApiResponse {
  status: 'success' | 'error';
  data?: ComparisonResult;
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

export interface ClauseEmbedding {
  clauseId: string;
  embedding: number[];
}

export interface RelevantClauseMatch {
  clause: Clause;
  similarity: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  citedClauseIds?: string[];
  retrievedClauses?: Clause[];
  verification?: {
    status: VerificationStatus;
    confidence?: number;
    details?: string;
    lexicalPassed?: boolean;
    llmJudgePassed?: boolean;
  };
}

export type ChatStreamChunk =
  | { type: 'retrieval'; retrievedClauses: Clause[]; citedClauseIds?: string[] }
  | { type: 'token'; content: string }
  | {
      type: 'verification';
      verification: {
        status: VerificationStatus;
        confidence: number;
        details: string;
        lexicalPassed: boolean;
        llmJudgePassed: boolean;
      };
      citedClauseIds: string[];
    }
  | { type: 'error'; message: string };



