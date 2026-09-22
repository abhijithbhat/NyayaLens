'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import {
  Clause,
  ParsedDocument,
  ParseApiResponse,
  AnalyzedClause,
  SimplifyApiResponse,
  RiskSeverity,
  Language,
  ChecklistItem,
  ChecklistApiResponse,
} from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import ChecklistView from '@/components/ChecklistView';
import LanguageSelector from '@/components/LanguageSelector';
import { VerificationBadge, RiskBadge } from '@/components/StatusBadges';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CATEGORY_COLORS: Record<string, string> = {
  Payment: 'bg-[var(--accent-primary)]/10 text-[var(--accent-bright)] border-[var(--accent-primary)]/30',
  Termination: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  Liability: 'bg-[#EAB308]/15 text-[#FDE047] border-[#EAB308]/30',
  Deposit: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  Notice: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  Other: 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border-[var(--text-muted)]/30',
};

const RISK_COLORS: Record<RiskSeverity, string> = {
  high: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  medium: 'bg-[#EAB308]/15 text-[#FDE047] border-[#EAB308]/40',
  low: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  none: 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border-[var(--text-muted)]/30',
  unknown: 'border-dashed border-[var(--text-muted)]/60 bg-[var(--bg-surface-raised)]/60 text-[var(--text-muted)]',
};

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<ParsedDocument | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Multilingual & Checklist State
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [generatingChecklist, setGeneratingChecklist] = useState(false);

  // Phase 3 State
  const [simplifying, setSimplifying] = useState(false);
  const [analyzedClauses, setAnalyzedClauses] = useState<AnalyzedClause[] | null>(null);
  const [summaryMetrics, setSummaryMetrics] = useState<{
    totalClauses: number;
    verifiedCount: number;
    needsReviewCount: number;
    highRiskCount: number;
  } | null>(null);

  // Restore active document if user navigates back to /analyze
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeDocId = sessionStorage.getItem('nyayalens_active_doc_id');
    if (activeDocId) {
      const cached = sessionStorage.getItem(`nyayalens_doc_${activeDocId}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setDocumentData((prev) => prev || parsed);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    setDocumentData(null);
    setAnalyzedClauses(null);
    setSummaryMetrics(null);

    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      return;
    }

    const selectedFile = e.target.files[0];

    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError(
        `Unsupported file type "${extension}". Please select a PDF or image file (.pdf, .png, .jpg, .jpeg, .webp).`
      );
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File is too large (${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB}MB.`
      );
      setFile(null);
      return;
    }

    setFile(selectedFile);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file to ingest.');
      return;
    }

    setLoading(true);
    setError(null);
    setDocumentData(null);
    setAnalyzedClauses(null);
    setSummaryMetrics(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      const json: ParseApiResponse = await res.json();

      if (!res.ok || json.status === 'error' || !json.data) {
        setError(json.message || `Failed to parse document (HTTP ${res.status}).`);
      } else {
        setDocumentData(json.data);
        try {
          sessionStorage.setItem(`nyayalens_doc_${json.data.id}`, JSON.stringify(json.data));
          sessionStorage.setItem('nyayalens_active_doc_id', json.data.id);
        } catch {
          // ignore session storage quota errors
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error occurred during upload.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRunSimplification(overrideLang?: Language) {
    if (!documentData) return;

    const lang: Language = typeof overrideLang === 'string' ? overrideLang : selectedLanguage;
    setSimplifying(true);
    setError(null);

    try {
      const res = await fetch('/api/simplify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: documentData, language: lang }),
      });

      const json: SimplifyApiResponse = await res.json();

      if (!res.ok || json.status === 'error' || !json.data) {
        setError(json.message || `Simplification failed with status ${res.status}`);
      } else {
        setAnalyzedClauses(json.data.analyzedClauses);
        setSummaryMetrics(json.data.summary);
        // Automatically generate pre-signing checklist with the verified analysis
        handleGenerateChecklist(json.data.analyzedClauses, lang);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error occurred during simplification.');
    } finally {
      setSimplifying(false);
    }
  }

  async function handleGenerateChecklist(clausesToUse?: AnalyzedClause[], langOverride?: Language) {
    const clauses = clausesToUse || analyzedClauses;
    if (!clauses || clauses.length === 0) return;

    const lang: Language = typeof langOverride === 'string' ? langOverride : selectedLanguage;
    setGeneratingChecklist(true);

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document: {
            ...documentData,
            clauses,
          },
          language: lang,
        }),
      });

      const json: ChecklistApiResponse = await res.json();
      if (res.ok && json.status === 'success' && json.data) {
        setChecklistItems(json.data.items);
      }
    } catch (cErr) {
      console.warn('Checklist generation error:', cErr);
    } finally {
      setGeneratingChecklist(false);
    }
  }

  function handleToggleChecklistItem(itemId: string) {
    setChecklistItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, completed: !item.completed } : item))
    );
  }

  function handleLanguageChange(newLang: Language) {
    setSelectedLanguage(newLang);
    if (analyzedClauses && analyzedClauses.length > 0) {
      handleRunSimplification(newLang);
    }
  }

  const categoryCounts: Record<string, number> = {};
  if (documentData) {
    documentData.clauses.forEach((c) => {
      const cat = c.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  }

  const displayedClauses: (Clause | AnalyzedClause)[] = analyzedClauses || documentData?.clauses || [];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Unified App Header */}
      <AppHeader
        activeDocId={documentData?.id}
        extraControls={
          <LanguageSelector
            value={selectedLanguage}
            onChange={handleLanguageChange}
            disabled={simplifying || generatingChecklist}
          />
        }
      />

      <main className="flex-1 p-6 md:p-12">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Subheader Title */}
          <div className="border-b border-[var(--bg-surface-raised)] pb-5">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)]">
                Dual-Gate Analysis
              </span>
              <span className="text-xs text-[var(--text-muted)]">Verified Legal Co-Pilot</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)] font-display mt-1">
              Document Ingestion, Dual-Gate Verification &amp; Checklist
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Extract clauses with lexical grounding (Gate 1), LLM-Judge verification (Gate 2), multilingual explanations &amp; advocate questions.
            </p>
          </div>

        {/* Upload Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl p-6 space-y-5 shadow-xl"
        >
          <div>
            <label
              htmlFor="document-file-input"
              className="block text-sm font-medium text-[var(--text-primary)] mb-2"
            >
              Select Legal Document (PDF, PNG, JPG, WebP &bull; Max 10MB)
            </label>
            <input
              id="document-file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={handleFileChange}
              disabled={loading || simplifying}
              className="w-full text-sm text-[var(--text-muted)] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-[var(--accent-primary)] file:text-white hover:file:bg-[var(--accent-bright)] file:cursor-pointer bg-[var(--bg-base)]/60 rounded-xl border border-[var(--bg-surface-raised)] p-2 cursor-pointer focus:outline-none focus:border-[var(--accent-primary)]"
            />
            {file && (
              <p className="text-xs text-[var(--text-muted)] mt-2">
                Selected: <span className="font-mono text-[var(--text-primary)]">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="parse-submit-btn"
              type="submit"
              disabled={!file || loading || simplifying}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-bright)] active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium shadow-md shadow-[var(--accent-primary)]/20 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Segmenting clauses...</span>
                </>
              ) : (
                <span>Upload & Ingest Document</span>
              )}
            </button>
            {loading && (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">
                Gemini parsing document structure into clauses...
              </span>
            )}
          </div>
        </form>

        {/* Error Notification */}
        {error && (
          <div
            id="parse-error-banner"
            className="rounded-xl bg-rose-950/40 border border-rose-500/40 p-4 text-rose-300 space-y-1 animate-in fade-in"
          >
            <div className="flex items-center gap-2 font-semibold text-sm text-rose-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Error</span>
            </div>
            <p className="text-xs font-mono break-words pl-6">{error}</p>
          </div>
        )}

        {/* Results View */}
        {documentData && (
          <div id="parsed-results-container" className="space-y-6 animate-in fade-in">
            {/* Top Toolbar / Simplification Trigger */}
            <div className="bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl p-6 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Active Document</span>
                  <p className="font-mono text-base text-[var(--text-primary)] font-semibold">{documentData.filename}</p>
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)]">Extracted Clauses</span>
                  <p id="clause-count-display" className="text-2xl font-bold text-[var(--accent-bright)]">
                    {documentData.clauses.length}
                  </p>
                </div>

                {/* Primary Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    id="run-simplify-btn"
                    onClick={() => handleRunSimplification()}
                    disabled={simplifying}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-bright)] active:opacity-90 disabled:opacity-40 text-white font-medium text-sm shadow-lg shadow-[var(--accent-primary)]/20 transition cursor-pointer"
                  >
                    {simplifying ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Running Dual-Gate Verification...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Run AI Simplification & Dual-Gate Verification</span>
                      </>
                    )}
                  </button>

                  <Link
                    id="open-doc-chat-btn"
                    href={`/chat/${documentData.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] text-[var(--text-primary)] font-medium text-sm transition"
                  >
                    <svg className="w-4 h-4 text-[var(--accent-bright)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <span>Chat Q&A with Doc &rarr;</span>
                  </Link>

                  <Link
                    id="open-doc-compare-btn"
                    href={`/compare?docA=${documentData.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] text-[var(--text-primary)] font-medium text-sm transition"
                  >
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    <span>Compare with Another Doc &rarr;</span>
                  </Link>
                </div>
              </div>

              {/* Summary Metrics when Verification has run */}
              {summaryMetrics && (
                <div id="verification-summary-banner" className="pt-4 border-t border-[var(--bg-surface-raised)] flex flex-wrap items-center gap-3">
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Dual-Gate Results:</span>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--accent-primary)]/15 text-[var(--accent-bright)] border border-[var(--accent-primary)]/40">
                    ✓ {summaryMetrics.verifiedCount} Verified
                  </span>
                  {summaryMetrics.needsReviewCount > 0 && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#EAB308]/15 text-[#FDE047] border border-[#EAB308]/40">
                      ⚠ {summaryMetrics.needsReviewCount} Needs Review (Abstained)
                    </span>
                  )}
                  {summaryMetrics.highRiskCount > 0 && (
                    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      🚨 {summaryMetrics.highRiskCount} High Risk Flags
                    </span>
                  )}
                </div>
              )}

              {/* Categories & JSON Toggle */}
              <div className="pt-2 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {Object.entries(categoryCounts).map(([category, count]) => (
                    <span
                      key={category}
                      className={`text-xs px-2.5 py-0.5 rounded-full border ${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}`}
                    >
                      {category}: {count}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs px-3 py-1 rounded-lg bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--bg-surface-raised)] cursor-pointer"
                >
                  {showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                </button>
              </div>
            </div>

            {/* Raw JSON viewer */}
            {showRawJson && (
              <div className="bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] rounded-xl p-4 overflow-x-auto text-xs font-mono text-[var(--text-muted)] max-h-96">
                <pre id="raw-json-output">
                  {JSON.stringify(analyzedClauses || documentData.clauses, null, 2)}
                </pre>
              </div>
            )}

            {/* Pre-Signing Checklist & Advocate Questions */}
            {(checklistItems.length > 0 || generatingChecklist) && (
              <div id="analyze-checklist-section">
                <ChecklistView
                  items={checklistItems}
                  language={selectedLanguage}
                  onToggleItem={handleToggleChecklistItem}
                  isLoading={generatingChecklist}
                  onRegenerate={() => handleGenerateChecklist()}
                  title="Document Pre-Signing Action Checklist"
                  subtitle="Ground-verified next steps & advocate consultation inquiries for medium/high risk or unverified terms."
                />
              </div>
            )}

            {/* Clauses List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-[var(--text-primary)] font-display">Clause Analysis &amp; Verification</h2>
                <span className="text-xs text-[var(--text-muted)]">Every claim is grounded and dual-gate verified</span>
              </div>

              <div className="space-y-4" id="clauses-list">
                {displayedClauses.map((clauseItem, idx) => {
                  const hasAnalysis = 'analysis' in clauseItem && clauseItem.analysis !== undefined;
                  const analysis = hasAnalysis ? (clauseItem as AnalyzedClause).analysis : null;
                  const isVerified = analysis?.verification.status === 'verified';

                  return (
                    <div
                      key={clauseItem.id || idx}
                      className="clause-card bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl p-6 space-y-4 hover:border-[var(--accent-primary)]/40 transition shadow-sm"
                    >
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          {clauseItem.sectionNumber && (
                            <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                              {clauseItem.sectionNumber}
                            </span>
                          )}
                          <h3 className="font-bold text-[var(--text-primary)] font-display text-base">{clauseItem.heading}</h3>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Dual-Gate Status Badge */}
                          {hasAnalysis && (
                            <>
                              <VerificationBadge
                                status={analysis?.verification.status || 'needs_review'}
                                label={
                                  isVerified
                                    ? `Dual-Gate Verified (${Math.round((analysis?.verification.confidence || 0) * 100)}%)`
                                    : 'Needs Review • Unverified'
                                }
                                details={analysis?.verification.details}
                              />

                              {/* Risk Severity Badge */}
                              <RiskBadge severity={analysis?.risk.severity || 'low'} />
                            </>
                          )}

                          {/* Category Badge */}
                          <span
                            className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                              CATEGORY_COLORS[clauseItem.category] || CATEGORY_COLORS.Other
                            }`}
                          >
                            {clauseItem.category}
                          </span>
                        </div>
                      </div>

                      {/* Simplification & Risk Card (when analyzed) */}
                      {hasAnalysis && (
                        <>
                          {isVerified ? (
                            <div className="explanation-container bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/25 rounded-xl p-4 space-y-2.5">
                              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--accent-bright)] uppercase tracking-wide">
                                <span>💡 Plain-Language Meaning</span>
                              </div>
                              <p className="clause-explanation text-sm text-[var(--text-primary)] leading-relaxed font-normal">
                                {analysis?.explanation}
                              </p>
                              {analysis?.risk.reason && (
                                <div className="text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--accent-primary)]/20 flex items-start gap-1.5">
                                  <span className="font-semibold text-[var(--accent-bright)] whitespace-nowrap">Risk Context:</span>
                                  <span>{analysis?.risk.reason}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="abstention-container bg-[#EAB308]/10 border border-[#EAB308]/30 rounded-xl p-4 space-y-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-[#FDE047] uppercase tracking-wide">
                                <span>⚠ Abstention Notice: Manual Reading Required</span>
                              </div>
                              <p className="clause-abstention text-xs font-mono text-[#FEF08A] leading-relaxed">
                                {analysis?.verification.details ||
                                  'In accordance with NyayaLens zero-hallucination policy, automated claims were not verified against the source text. Please refer exclusively to the verbatim legal text below.'}
                              </p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Source Clause Verbatim Box */}
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
                          Source Clause (Verbatim)
                        </span>
                        <div className="bg-[var(--bg-base)]/80 rounded-xl p-3.5 border border-[var(--bg-surface-raised)]">
                          <p className="text-xs font-mono text-[var(--text-muted)] leading-relaxed whitespace-pre-wrap">
                            {clauseItem.rawText}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  </div>
  );
}
