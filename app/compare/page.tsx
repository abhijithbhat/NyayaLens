'use client';

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import {
  ParsedDocument,
  ParseApiResponse,
  CompareApiResponse,
  ComparisonResult,
  MatchedClausePair,
  UnmatchedClause,
  DiffParty,
  Language,
  ChecklistItem,
  ChecklistApiResponse,
} from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import ChecklistView from '@/components/ChecklistView';
import LanguageSelector from '@/components/LanguageSelector';
import { VerificationBadge } from '@/components/StatusBadges';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export default function ComparePage() {
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);

  const [parsingA, setParsingA] = useState(false);
  const [parsingB, setParsingB] = useState(false);

  const [docA, setDocA] = useState<ParsedDocument | null>(null);
  const [docB, setDocB] = useState<ParsedDocument | null>(null);

  const [comparing, setComparing] = useState(false);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Multilingual & Checklist State
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('en');
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [generatingChecklist, setGeneratingChecklist] = useState(false);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'diffs' | 'unmatched'>('all');
  const [filterFavors, setFilterFavors] = useState<'ALL' | DiffParty>('ALL');
  const [showRawJson, setShowRawJson] = useState(false);

  // Auto-load docA from query param or active session from /analyze
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const docAId = params.get('docA') || sessionStorage.getItem('nyayalens_active_doc_id');
    if (docAId) {
      const cached = sessionStorage.getItem(`nyayalens_doc_${docAId}`);
      if (cached) {
        try {
          const parsed: ParsedDocument = JSON.parse(cached);
          setDocA(parsed);
        } catch (e) {
          console.error('Failed to parse docA from sessionStorage', e);
        }
      } else if (docAId === 'doc-rental-agreement-a') {
        import('@/samples/parsed_docA.json').then((m) => setDocA(m.default as ParsedDocument));
      } else if (docAId === 'doc-rental-agreement-b' || docAId.includes('v2')) {
        import('@/samples/parsed_docB.json').then((m) => setDocA(m.default as ParsedDocument));
      }
    }

    const docBId = params.get('docB');
    if (docBId) {
      const cached = sessionStorage.getItem(`nyayalens_doc_${docBId}`);
      if (cached) {
        try {
          const parsed: ParsedDocument = JSON.parse(cached);
          setDocB(parsed);
        } catch (e) {
          console.error('Failed to parse docB from sessionStorage', e);
        }
      } else if (docBId === 'doc-rental-agreement-b' || docBId.includes('v2')) {
        import('@/samples/parsed_docB.json').then((m) => setDocB(m.default as ParsedDocument));
      }
    }
  }, []);

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>, target: 'A' | 'B') {
    setError(null);
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Invalid file type "${ext}". Please upload PDF or image files.`);
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(2)} MB). Max limit is 10MB.`);
      return;
    }

    if (target === 'A') {
      setFileA(file);
      setDocA(null);
    } else {
      setFileB(file);
      setDocB(null);
    }
    setComparisonResult(null);
  }

  async function handleParseDoc(target: 'A' | 'B') {
    const file = target === 'A' ? fileA : fileB;
    if (!file) return;

    if (target === 'A') setParsingA(true);
    else setParsingB(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });

      const json: ParseApiResponse = await res.json();
      if (!res.ok || json.status === 'error' || !json.data) {
        throw new Error(json.message || `Failed to parse Document ${target}`);
      }

      if (target === 'A') setDocA(json.data);
      else setDocB(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Error parsing Document ${target}`);
    } finally {
      if (target === 'A') setParsingA(false);
      else setParsingB(false);
    }
  }

  async function handleRunComparison() {
    if (!docA || !docB) {
      setError('Both Document A and Document B must be ingested first.');
      return;
    }

    setComparing(true);
    setError(null);

    try {
      const res = await fetch('/api/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentA: docA, documentB: docB }),
      });

      const json: CompareApiResponse = await res.json();
      if (!res.ok || json.status === 'error' || !json.data) {
        throw new Error(json.message || 'Comparison failed.');
      }

      setComparisonResult(json.data);
      handleGenerateChecklist(json.data, selectedLanguage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing comparison pipeline.');
    } finally {
      setComparing(false);
    }
  }

  async function handleGenerateChecklist(compData?: ComparisonResult, langOverride?: Language) {
    const comp = compData || comparisonResult;
    if (!comp) return;

    const lang = langOverride || selectedLanguage;
    setGeneratingChecklist(true);

    try {
      const res = await fetch('/api/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparison: comp,
          language: lang,
        }),
      });

      const json: ChecklistApiResponse = await res.json();
      if (res.ok && json.status === 'success' && json.data) {
        setChecklistItems(json.data.items);
      }
    } catch (cErr) {
      console.warn('Compare checklist generation error:', cErr);
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
    if (comparisonResult) {
      handleGenerateChecklist(comparisonResult, newLang);
    }
  }

  // Filter matched pairs
  const filteredPairs = (comparisonResult?.matchedPairs || []).filter((pair) => {
    if (activeTab === 'diffs' && !pair.difference) return false;
    if (filterFavors !== 'ALL' && pair.favors !== filterFavors) return false;
    return true;
  });

  const unmatchedA = (comparisonResult?.unmatchedClauses || []).filter((u) => u.onlyIn === 'A');
  const unmatchedB = (comparisonResult?.unmatchedClauses || []).filter((u) => u.onlyIn === 'B');

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Unified App Header */}
      <AppHeader
        activeDocId={docA?.id || docB?.id}
        extraControls={
          <LanguageSelector
            value={selectedLanguage}
            onChange={handleLanguageChange}
            disabled={comparing || generatingChecklist}
          />
        }
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-display">
            Contract Version Comparison & Side-by-Side Diff
          </h1>
          <p className="text-[var(--text-muted)] text-sm max-w-3xl leading-relaxed">
            Upload two contracts (e.g. Original vs Renewal, Landlord draft vs Tenant markup).
            NyayaLens automatically aligns clauses, identifies which party is favored, and independently verifies every diff claim
            against <strong className="text-[var(--text-primary)]">both source documents</strong> before display.
          </p>
        </section>

        {/* Error Banner */}
        {error && (
          <div
            id="compare-error-banner"
            className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start justify-between"
          >
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-4 text-rose-400 hover:text-rose-200 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Dual Upload Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document A Box */}
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center text-xs font-bold">
                  A
                </span>
                <h2 className="font-semibold text-[var(--text-primary)] font-display">Document A (Base Version)</h2>
              </div>
              {docA && (
                <span className="text-xs bg-[var(--accent-primary)]/15 text-[var(--accent-bright)] border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full font-medium">
                  {docA.clauses.length} Clauses Ready
                </span>
              )}
            </div>

            {docA && (
              <div className="p-3.5 rounded-xl bg-[var(--bg-base)]/80 border border-[var(--accent-primary)]/30 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold">Active Document</span>
                  <span className="text-[10px] text-[var(--accent-bright)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 px-1.5 py-0.5 rounded font-mono">
                    {docA.id}
                  </span>
                </div>
                <p id="doc-a-filename-display" className="text-xs font-mono text-[var(--accent-bright)] font-semibold truncate">
                  {docA.filename}
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Imported and ready for comparison against Document B.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="doc-a-file-input" className="block text-xs font-medium text-[var(--text-muted)]">
                Select PDF or Document Image (Document A)
              </label>
              <input
                type="file"
                id="doc-a-file-input"
                aria-label="Upload Document A file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e, 'A')}
                className="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-primary)] file:text-white hover:file:bg-[var(--accent-bright)] cursor-pointer border border-[var(--bg-surface-raised)] rounded-xl bg-[var(--bg-base)]/60 p-1"
              />
              {fileA && (
                <p className="text-xs text-[var(--text-muted)]">
                  Selected: <span className="text-[var(--text-primary)] font-medium">{fileA.name}</span> (
                  {(fileA.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="button"
              id="parse-doc-a-btn"
              onClick={() => handleParseDoc('A')}
              disabled={!fileA || parsingA || Boolean(docA)}
              aria-label={parsingA ? "Parsing Document A..." : docA ? "Document A Ready" : "Parse Document A"}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {parsingA ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Parsing Document A...
                </>
              ) : docA ? (
                '✓ Document A Ready'
              ) : (
                'Parse Document A'
              )}
            </button>
          </div>

          {/* Document B Box */}
          <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#EAB308]/20 text-[#FDE047] border border-[#EAB308]/30 flex items-center justify-center text-xs font-bold">
                  B
                </span>
                <h2 className="font-semibold text-[var(--text-primary)] font-display">Document B (Modified / Renewal Version)</h2>
              </div>
              {docB && (
                <span className="text-xs bg-[var(--accent-primary)]/15 text-[var(--accent-bright)] border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded-full">
                  {docB.clauses.length} Clauses Parsed
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="doc-b-file-input" className="block text-xs font-medium text-[var(--text-muted)]">
                Select PDF or Document Image (Document B)
              </label>
              <input
                type="file"
                id="doc-b-file-input"
                aria-label="Upload Document B file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e, 'B')}
                className="block w-full text-xs text-[var(--text-muted)] file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[var(--accent-primary)] file:text-white hover:file:bg-[var(--accent-bright)] cursor-pointer border border-[var(--bg-surface-raised)] rounded-xl bg-[var(--bg-base)]/60 p-1"
              />
              {fileB && (
                <p className="text-xs text-[var(--text-muted)]">
                  Selected: <span className="text-[var(--text-primary)] font-medium">{fileB.name}</span> (
                  {(fileB.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="button"
              id="parse-doc-b-btn"
              onClick={() => handleParseDoc('B')}
              disabled={!fileB || parsingB || Boolean(docB)}
              aria-label={parsingB ? "Parsing Document B..." : docB ? "Document B Ready" : "Parse Document B"}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-medium bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {parsingB ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Parsing Document B...
                </>
              ) : docB ? (
                '✓ Document B Ready'
              ) : (
                'Parse Document B'
              )}
            </button>
          </div>
        </section>

        {/* Compare Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] shadow-xl">
          <div className="space-y-1">
            <h3 className="font-semibold text-[var(--text-primary)] font-display text-sm">Execute Batched Comparison Pipeline</h3>
            <p className="text-xs text-[var(--text-muted)]">
              Aligns clauses &bull; Generates difference claims &bull; Two-sided verification against both source clauses in 3 batched calls
            </p>
          </div>

          <button
            type="button"
            id="compare-action-btn"
            onClick={handleRunComparison}
            disabled={!docA || !docB || comparing}
            aria-label={comparing ? "Comparing and verifying documents..." : "Compare Legal Documents"}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-xs bg-[var(--accent-primary)] hover:bg-[var(--accent-bright)] active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-[var(--accent-primary)]/25 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {comparing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Comparing & Verifying (3 Batched Calls)...
              </>
            ) : (
              'Compare Legal Documents'
            )}
          </button>
        </div>


        {/* Comparison Results */}
        {comparisonResult && (
          <section id="comparison-results-container" className="space-y-6">
            {/* KPI Summary Header */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">Matched Pairs</span>
                <p className="text-xl font-bold text-[var(--text-primary)] mt-1 font-display">
                  {comparisonResult.summary.matchedCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">Favors Doc A</span>
                <p className="text-xl font-bold text-sky-400 mt-1 font-display">
                  {comparisonResult.summary.favorsACount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">Favors Doc B</span>
                <p className="text-xl font-bold text-[#FDE047] mt-1 font-display">
                  {comparisonResult.summary.favorsBCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">Only in Doc A</span>
                <p className="text-xl font-bold text-amber-400 mt-1 font-display">
                  {comparisonResult.summary.unmatchedCountA}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">Only in Doc B</span>
                <p className="text-xl font-bold text-[var(--accent-bright)] mt-1 font-display">
                  {comparisonResult.summary.unmatchedCountB}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)]">
                <span className="text-xs text-[var(--text-muted)]">API Calls</span>
                <p className="text-xl font-bold text-[var(--accent-bright)] mt-1 font-display">
                  {comparisonResult.summary.apiCallsCount ?? 3}
                </p>
              </div>
            </div>

            {/* Pre-Signing Comparison Action Checklist & Advocate Questions */}
            {(checklistItems.length > 0 || generatingChecklist) && (
              <div id="compare-checklist-section">
                <ChecklistView
                  items={checklistItems}
                  language={selectedLanguage}
                  onToggleItem={handleToggleChecklistItem}
                  isLoading={generatingChecklist}
                  onRegenerate={() => handleGenerateChecklist()}
                  title="Comparison Action Checklist & Advocate Inquiries"
                  subtitle="Critical contract modifications & unilateral clauses needing confirmation or advocate consultation before signing."
                />
              </div>
            )}

            {/* Filter and Tab Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--bg-surface-raised)] pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'all'
                      ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  All Matched ({comparisonResult.matchedPairs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors cursor-pointer ${
                    activeTab === 'unmatched'
                      ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                      : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Unmatched Clauses ({comparisonResult.unmatchedClauses.length})
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-[var(--text-muted)]">Filter Favors:</span>
                  <select
                    value={filterFavors}
                    onChange={(e) => setFilterFavors(e.target.value as any)}
                    className="bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-lg px-2 py-1 text-xs text-[var(--text-primary)]"
                  >
                    <option value="ALL">All Outcomes</option>
                    <option value="A">Favors Document A</option>
                    <option value="B">Favors Document B</option>
                    <option value="neutral">Neutral / Balanced</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] underline cursor-pointer"
                >
                  {showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                </button>
              </div>
            </div>

            {/* Raw JSON Debug Box */}
            {showRawJson && (
              <div className="p-4 rounded-xl bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] font-mono text-xs overflow-x-auto max-h-96 text-[var(--text-muted)]">
                <pre>{JSON.stringify(comparisonResult, null, 2)}</pre>
              </div>
            )}

            {/* UNMATCHED TAB */}
            {activeTab === 'unmatched' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Only in Doc A */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--bg-surface-raised)]">
                    <h3 className="font-semibold text-amber-400 font-display text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      Only in Document A ({unmatchedA.length})
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">Omitted in Document B</span>
                  </div>

                  {unmatchedA.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--bg-surface-raised)]">
                      No unique clauses exclusively in Document A.
                    </p>
                  ) : (
                    unmatchedA.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[var(--bg-surface)] border border-amber-500/25 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {item.clause.sectionNumber ? `${item.clause.sectionNumber} - ` : ''}
                            {item.clause.heading}
                          </span>
                          <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                            {item.clause.category}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-base)]/80 p-3 rounded-lg leading-relaxed font-mono">
                          {item.clause.rawText}
                        </p>
                        <p className="text-[11px] text-amber-300/80">
                          ⚠️ This obligation exists in Document A but has been completely removed in Document B.
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Only in Doc B */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-[var(--bg-surface-raised)]">
                    <h3 className="font-semibold text-[var(--accent-bright)] font-display text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-bright)]"></span>
                      Only in Document B ({unmatchedB.length})
                    </h3>
                    <span className="text-xs text-[var(--text-muted)]">New Addition in Document B</span>
                  </div>

                  {unmatchedB.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)] italic p-4 bg-[var(--bg-surface)] rounded-xl border border-[var(--bg-surface-raised)]">
                      No unique clauses exclusively in Document B.
                    </p>
                  ) : (
                    unmatchedB.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-primary)]/25 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[var(--text-primary)]">
                            {item.clause.sectionNumber ? `${item.clause.sectionNumber} - ` : ''}
                            {item.clause.heading}
                          </span>
                          <span className="text-xs bg-[var(--accent-primary)]/10 text-[var(--accent-bright)] border border-[var(--accent-primary)]/30 px-2 py-0.5 rounded">
                            {item.clause.category}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] bg-[var(--bg-base)]/80 p-3 rounded-lg leading-relaxed font-mono">
                          {item.clause.rawText}
                        </p>
                        <p className="text-[11px] text-[var(--accent-bright)]/80">
                          ℹ️ This provision is newly introduced in Document B and has no precedent in Document A.
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* MATCHED PAIRS TAB */}
            {activeTab !== 'unmatched' && (
              <div className="space-y-6">
                {filteredPairs.length === 0 ? (
                  <div className="p-8 text-center text-[var(--text-muted)] text-sm bg-[var(--bg-surface)] rounded-2xl border border-[var(--bg-surface-raised)]">
                    No matched clauses match the current filters.
                  </div>
                ) : (
                  filteredPairs.map((pair) => {
                    const isVerified = pair.verification.status === 'verified';
                    const favorsColor =
                      pair.favors === 'A'
                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                        : pair.favors === 'B'
                        ? 'bg-[#EAB308]/15 text-[#FDE047] border-[#EAB308]/30'
                        : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border-[var(--text-muted)]/30';

                    const favorsLabel =
                      pair.favors === 'A'
                        ? 'Favors Document A'
                        : pair.favors === 'B'
                        ? 'Favors Document B'
                        : 'Neutral / Balanced';

                    return (
                      <div
                        key={pair.id}
                        className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] overflow-hidden shadow-lg space-y-4 p-5"
                      >
                        {/* Pair Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--bg-surface-raised)]">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)] font-display">
                              {pair.clauseA.heading || 'Clause'} &harr; {pair.clauseB.heading || 'Clause'}
                            </span>
                            <span className="text-[11px] bg-[var(--bg-surface-raised)] text-[var(--text-muted)] px-2 py-0.5 rounded border border-[var(--bg-surface-raised)]">
                              {pair.clauseA.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isVerified ? (
                              <>
                                <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${favorsColor}`}>
                                  {favorsLabel}
                                </span>
                                <VerificationBadge
                                  status="verified"
                                  label={`Dual-Gate Verified (${Math.round(pair.verification.confidence * 100)}%)`}
                                  details={pair.verification.details}
                                />
                              </>
                            ) : (
                              <VerificationBadge
                                status="needs_review"
                                label="Needs Review • No Comparison Shown"
                                details={pair.verification.details || 'Ungrounded difference claim suppressed'}
                              />
                            )}
                          </div>
                        </div>

                        {/* Verified Diff Summary Box */}
                        <div className="p-4 rounded-xl bg-[var(--bg-base)]/80 border border-[var(--bg-surface-raised)] space-y-2">
                          <span className="text-[11px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                            Difference Analysis
                          </span>

                          {isVerified && pair.difference ? (
                            <>
                              <p className="text-xs text-[var(--text-primary)] leading-relaxed font-medium">
                                {pair.difference}
                              </p>
                              {pair.favorsReason && (
                                <p className="text-[11px] text-[var(--text-muted)]">
                                  <strong className="text-[var(--text-primary)]">Rationale:</strong> {pair.favorsReason}
                                </p>
                              )}
                            </>
                          ) : (
                            <div className="rounded-lg bg-[#EAB308]/10 border border-[#EAB308]/25 p-3 space-y-1">
                              <p className="text-xs text-[#FDE047] font-medium">
                                Needs review &bull; No comparison shown
                              </p>
                              <p className="text-[11px] text-[#FEF08A]/75 leading-relaxed">
                                {pair.verification.details || 'Diff claim could not be independently verified against both source clauses and was suppressed per strict safety policy.'}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Side-by-Side Clause Texts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {/* Clause A */}
                          <div className="p-4 rounded-xl bg-sky-950/20 border border-sky-900/30 space-y-2">
                            <div className="flex items-center justify-between text-xs text-sky-400 font-semibold">
                              <span>Document A: {pair.clauseA.sectionNumber || 'Clause'}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">{pair.clauseA.id}</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-mono whitespace-pre-wrap">
                              {pair.clauseA.rawText}
                            </p>
                          </div>

                          {/* Clause B */}
                          <div className="p-4 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/25 space-y-2">
                            <div className="flex items-center justify-between text-xs text-[#FDE047] font-semibold">
                              <span>Document B: {pair.clauseB.sectionNumber || 'Clause'}</span>
                              <span className="text-[10px] text-[var(--text-muted)]">{pair.clauseB.id}</span>
                            </div>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed font-mono whitespace-pre-wrap">
                              {pair.clauseB.rawText}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
