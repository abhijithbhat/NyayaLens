/**
 * Core data model for NyayaLens.
 * Aligned with product specifications in CONTEXT.md.
 */

export interface Clause {
  id: string;
  sectionNumber?: string;
  heading?: string;
  rawText: string;
  category: string; // "Payment" | "Termination" | "Liability" | "Deposit" | ...
}

export interface HealthcheckResponse {
  status: 'ok' | 'error';
  text?: string;
  message?: string;
  model?: string;
}
