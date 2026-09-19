'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import {
  ParsedDocument,
  ParseApiResponse,
  CompareApiResponse,
  ComparisonResult,
  MatchedClausePair,
  UnmatchedClause,
  DiffParty,
} from '@/lib/types';

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

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<'all' | 'diffs' | 'unmatched'>('all');
  const [filterFavors, setFilterFavors] = useState<'ALL' | DiffParty>('ALL');
  const [showRawJson, setShowRawJson] = useState(false);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error executing comparison pipeline.');
    } finally {
      setComparing(false);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              NL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-100">NyayaLens</span>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 font-medium">
                  Compare Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">Two-Sided Dual-Gate Verified Contract Diff</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/analyze"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Single Doc Analysis
            </Link>
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <section className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Contract Version Comparison & Side-by-Side Diff
          </h1>
          <p className="text-slate-400 text-sm max-w-3xl leading-relaxed">
            Upload two contracts (e.g. Original vs Renewal, Landlord draft vs Tenant markup).
            NyayaLens automatically aligns clauses, identifies which party is favored, and independently verifies every diff claim
            against <strong className="text-slate-200">both source documents</strong> before display.
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
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold">
                  A
                </span>
                <h2 className="font-semibold text-slate-200">Document A (Base Version)</h2>
              </div>
              {docA && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {docA.clauses.length} Clauses Parsed
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Select PDF or Document Image
              </label>
              <input
                type="file"
                id="doc-a-file-input"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e, 'A')}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer border border-slate-700/60 rounded-xl bg-slate-950/50 p-1"
              />
              {fileA && (
                <p className="text-xs text-slate-400">
                  Selected: <span className="text-slate-200 font-medium">{fileA.name}</span> (
                  {(fileA.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="button"
              id="parse-doc-a-btn"
              onClick={() => handleParseDoc('A')}
              disabled={!fileA || parsingA || Boolean(docA)}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {parsingA ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
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
          <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30 flex items-center justify-center text-xs font-bold">
                  B
                </span>
                <h2 className="font-semibold text-slate-200">Document B (Modified / Renewal Version)</h2>
              </div>
              {docB && (
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  {docB.clauses.length} Clauses Parsed
                </span>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-400">
                Select PDF or Document Image
              </label>
              <input
                type="file"
                id="doc-b-file-input"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(e) => handleFileSelect(e, 'B')}
                className="block w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer border border-slate-700/60 rounded-xl bg-slate-950/50 p-1"
              />
              {fileB && (
                <p className="text-xs text-slate-400">
                  Selected: <span className="text-slate-200 font-medium">{fileB.name}</span> (
                  {(fileB.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <button
              type="button"
              id="parse-doc-b-btn"
              onClick={() => handleParseDoc('B')}
              disabled={!fileB || parsingB || Boolean(docB)}
              className="w-full py-2 px-4 rounded-xl text-xs font-medium bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-violet-500/10 flex items-center justify-center gap-2"
            >
              {parsingB ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800">
          <div className="space-y-1">
            <h3 className="font-semibold text-slate-200 text-sm">Execute Batched Comparison Pipeline</h3>
            <p className="text-xs text-slate-400">
              Aligns clauses &bull; Generates difference claims &bull; Two-sided verification against both source clauses in 3 batched calls
            </p>
          </div>

          <button
            type="button"
            id="compare-action-btn"
            onClick={handleRunComparison}
            disabled={!docA || !docB || comparing}
            className="w-full sm:w-auto px-6 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
          >
            {comparing ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
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
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Matched Pairs</span>
                <p className="text-xl font-bold text-white mt-1">
                  {comparisonResult.summary.matchedCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Favors Doc A</span>
                <p className="text-xl font-bold text-blue-400 mt-1">
                  {comparisonResult.summary.favorsACount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Favors Doc B</span>
                <p className="text-xl font-bold text-violet-400 mt-1">
                  {comparisonResult.summary.favorsBCount}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Only in Doc A</span>
                <p className="text-xl font-bold text-amber-400 mt-1">
                  {comparisonResult.summary.unmatchedCountA}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">Only in Doc B</span>
                <p className="text-xl font-bold text-purple-400 mt-1">
                  {comparisonResult.summary.unmatchedCountB}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400">API Calls</span>
                <p className="text-xl font-bold text-emerald-400 mt-1">
                  {comparisonResult.summary.apiCallsCount ?? 3}
                </p>
              </div>
            </div>

            {/* Filter and Tab Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('all')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All Matched ({comparisonResult.matchedPairs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('unmatched')}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                    activeTab === 'unmatched'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Unmatched Clauses ({comparisonResult.unmatchedClauses.length})
                </button>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-slate-400">Filter Favors:</span>
                  <select
                    value={filterFavors}
                    onChange={(e) => setFilterFavors(e.target.value as any)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-200"
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
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  {showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                </button>
              </div>
            </div>

            {/* Raw JSON Debug Box */}
            {showRawJson && (
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-xs overflow-x-auto max-h-96">
                <pre>{JSON.stringify(comparisonResult, null, 2)}</pre>
              </div>
            )}

            {/* UNMATCHED TAB */}
            {activeTab === 'unmatched' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Only in Doc A */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="font-semibold text-amber-400 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                      Only in Document A ({unmatchedA.length})
                    </h3>
                    <span className="text-xs text-slate-400">Omitted in Document B</span>
                  </div>

                  {unmatchedA.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-slate-900/40 rounded-xl">
                      No unique clauses exclusively in Document A.
                    </p>
                  ) : (
                    unmatchedA.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">
                            {item.clause.sectionNumber ? `${item.clause.sectionNumber} - ` : ''}
                            {item.clause.heading}
                          </span>
                          <span className="text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded">
                            {item.clause.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg leading-relaxed">
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
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <h3 className="font-semibold text-purple-400 text-sm flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400"></span>
                      Only in Document B ({unmatchedB.length})
                    </h3>
                    <span className="text-xs text-slate-400">New Addition in Document B</span>
                  </div>

                  {unmatchedB.length === 0 ? (
                    <p className="text-xs text-slate-500 italic p-4 bg-slate-900/40 rounded-xl">
                      No unique clauses exclusively in Document B.
                    </p>
                  ) : (
                    unmatchedB.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 rounded-xl bg-slate-900/60 border border-purple-500/20 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200">
                            {item.clause.sectionNumber ? `${item.clause.sectionNumber} - ` : ''}
                            {item.clause.heading}
                          </span>
                          <span className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                            {item.clause.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg leading-relaxed">
                          {item.clause.rawText}
                        </p>
                        <p className="text-[11px] text-purple-300/80">
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
                  <div className="p-8 text-center text-slate-500 text-sm bg-slate-900/40 rounded-2xl border border-slate-800">
                    No matched clauses match the current filters.
                  </div>
                ) : (
                  filteredPairs.map((pair) => {
                    const isVerified = pair.verification.status === 'verified';
                    const favorsColor =
                      pair.favors === 'A'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                        : pair.favors === 'B'
                        ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                        : 'bg-slate-700/30 text-slate-300 border-slate-600/40';

                    const favorsLabel =
                      pair.favors === 'A'
                        ? 'Favors Document A'
                        : pair.favors === 'B'
                        ? 'Favors Document B'
                        : 'Neutral / Balanced';

                    return (
                      <div
                        key={pair.id}
                        className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-lg space-y-4 p-5"
                      >
                        {/* Pair Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-300">
                              {pair.clauseA.heading || 'Clause'} &harr; {pair.clauseB.heading || 'Clause'}
                            </span>
                            <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
                              {pair.clauseA.category}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${favorsColor}`}>
                              {favorsLabel}
                            </span>

                            {isVerified ? (
                              <span
                                title={pair.verification.details}
                                className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 font-medium"
                              >
                                <svg className="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Dual-Gate Verified ({Math.round(pair.verification.confidence * 100)}%)
                              </span>
                            ) : (
                              <span
                                title={pair.verification.details}
                                className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 font-medium"
                              >
                                <svg className="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Needs Review
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Verified Diff Summary Box */}
                        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                          <span className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                            Difference Analysis
                          </span>

                          {isVerified && pair.difference ? (
                            <p className="text-xs text-slate-200 leading-relaxed font-medium">
                              {pair.difference}
                            </p>
                          ) : (
                            <p className="text-xs text-amber-300/80 italic">
                              Diff claim could not be independently verified against both source clauses and was suppressed per strict safety policy.
                            </p>
                          )}

                          {pair.favorsReason && (
                            <p className="text-[11px] text-slate-400">
                              <strong className="text-slate-300">Rationale:</strong> {pair.favorsReason}
                            </p>
                          )}
                        </div>

                        {/* Side-by-Side Clause Texts */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                          {/* Clause A */}
                          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 space-y-2">
                            <div className="flex items-center justify-between text-xs text-blue-400 font-semibold">
                              <span>Document A: {pair.clauseA.sectionNumber || 'Clause'}</span>
                              <span className="text-[10px] text-slate-400">{pair.clauseA.id}</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
                              {pair.clauseA.rawText}
                            </p>
                          </div>

                          {/* Clause B */}
                          <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-900/30 space-y-2">
                            <div className="flex items-center justify-between text-xs text-violet-400 font-semibold">
                              <span>Document B: {pair.clauseB.sectionNumber || 'Clause'}</span>
                              <span className="text-[10px] text-slate-400">{pair.clauseB.id}</span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
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
