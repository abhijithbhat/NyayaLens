'use client';

import { useState } from 'react';
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';

interface HealthResponse {
  status: 'ok' | 'error';
  text?: string;
  message?: string;
  model?: string;
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHealthcheck, setShowHealthcheck] = useState(false);

  async function checkHealth() {
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/healthcheck');
      const data: HealthResponse = await res.json();
      if (!res.ok || data.status === 'error') {
        setError(data.message || `Healthcheck failed with status ${res.status}`);
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Unified App Header */}
      <AppHeader
        extraControls={
          <button
            id="healthcheck-toggle-btn"
            onClick={() => {
              setShowHealthcheck(!showHealthcheck);
              if (!result && !loading) checkHealth();
            }}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--bg-surface-raised)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            System Status
          </button>
        }
      />

      {/* Hero Section */}
      <div className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)] text-xs font-semibold tracking-wide">
            <span>🛡️ Never Trust an Unverified AI Legal Claim</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] font-display leading-[1.15]">
            Self-Verifying AI Legal Co-Pilot for Indian Contracts
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-muted)] leading-relaxed max-w-2xl mx-auto">
            NyayaLens ingests everyday rental agreements, employment offers, and service contracts.
            Every generated simplification, risk flag, comparison diff, and Q&A answer is verified against
            the document’s source text before you see it. If a claim cannot be verified, NyayaLens abstains.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 text-[11px] text-[var(--text-muted)]">
            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)] shadow-[0_0_6px_var(--accent-bright)]"></span>
              Gate 1: Lexical &amp; Numerical Overlap
            </span>
            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)] shadow-[0_0_6px_var(--accent-primary)]"></span>
              Gate 2: Impartial LLM-Judge
            </span>
            <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#EAB308]"></span>
              Strict Abstention on Low Confidence
            </span>
          </div>
        </div>

        {/* The Three Modes: Distinctly Styled Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Card 1: Single Document Analysis (Featured Flagship Card) */}
          <div className="relative rounded-2xl bg-[var(--bg-surface)] border-2 border-[var(--accent-primary)]/40 hover:border-[var(--accent-primary)] p-6 flex flex-col justify-between space-y-6 transition-all group shadow-xl hover:shadow-[var(--accent-primary)]/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)] flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)]">
                  Primary Flow
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] font-display group-hover:text-[var(--accent-bright)] transition-colors">
                  Single Document Analysis
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2">
                  Clause-by-clause plain-language simplification, risk severity detection, and pre-signing checklists with advocate consultation questions.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-1 space-y-1.5 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-bright)] font-bold">✓</span>
                  <span>Verbatim source clause extraction</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-bright)] font-bold">✓</span>
                  <span>Trilingual (English, Hindi, Kannada)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[var(--accent-bright)] font-bold">✓</span>
                  <span>Mutual suppression on ungrounded claims</span>
                </div>
              </div>
            </div>

            <Link
              id="go-to-analyze-link"
              href="/analyze"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-bright)] active:opacity-90 text-white font-semibold text-xs shadow-lg shadow-[var(--accent-primary)]/25 transition cursor-pointer"
            >
              <span>Analyze Document &rarr;</span>
            </Link>
          </div>

          {/* Card 2: Contract Comparison (Side-by-Side Diff Motif) */}
          <div className="relative rounded-2xl bg-[var(--bg-surface)] border-2 border-sky-500/40 hover:border-sky-400 p-6 flex flex-col justify-between space-y-6 transition-all group shadow-xl hover:shadow-sky-500/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/25 text-sky-400 flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300">
                  Version Diff
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] font-display group-hover:text-sky-300 transition-colors">
                  Contract Version Comparison
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2">
                  Structured clause alignment between Base and Renewal drafts. Identifies which party each substantive difference favors.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-1 space-y-1.5 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">↔</span>
                  <span>Two-sided diff verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">⚖</span>
                  <span>Favors Party A / Party B / Neutral</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sky-400 font-bold">🔍</span>
                  <span>Unmatched &amp; omitted clause audit</span>
                </div>
              </div>
            </div>

            <Link
              id="go-to-compare-link"
              href="/compare"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500/15 hover:bg-sky-500 text-sky-200 hover:text-white border border-sky-500/40 font-semibold text-xs shadow-lg shadow-sky-500/10 transition cursor-pointer"
            >
              <span>Compare Contracts &rarr;</span>
            </Link>
          </div>

          {/* Card 3: Grounded Chat Q&A (Conversational Preview Motif) */}
          <div className="relative rounded-2xl bg-[var(--bg-surface)] border-2 border-[#EAB308]/40 hover:border-[#EAB308] p-6 flex flex-col justify-between space-y-6 transition-all group shadow-xl hover:shadow-[#EAB308]/10">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-[#EAB308]/10 border border-[#EAB308]/25 text-[#FDE047] flex items-center justify-center shadow-inner">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#EAB308]/10 border border-[#EAB308]/30 text-[#FDE047]">
                  Interactive Co-Pilot
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] font-display group-hover:text-[#FDE047] transition-colors">
                  Grounded Contract Q&amp;A
                </h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-2">
                  Interrogate any contract clause directly. Semantically retrieves relevant provisions, streams plain-English answers, and verifies every claim.
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="pt-1 space-y-1.5 text-[11px] text-[var(--text-muted)]">
                <div className="flex items-center gap-2">
                  <span className="text-[#FDE047] font-bold">💬</span>
                  <span>Top-5 semantic clause retrieval</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#FDE047] font-bold">⚡</span>
                  <span>Streaming token generation</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#FDE047] font-bold">📌</span>
                  <span>Exact clause citation &amp; evidence drawer</span>
                </div>
              </div>
            </div>

            <Link
              id="go-to-chat-link"
              href="/analyze"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#EAB308]/15 hover:bg-[#EAB308] text-[#FDE047] hover:text-[#14100D] border border-[#EAB308]/40 font-semibold text-xs shadow-lg shadow-[#EAB308]/10 transition cursor-pointer"
            >
              <span>Upload to Start Q&A &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Informational Disclaimer Banner */}
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] p-4 text-center space-y-1">
          <p className="text-xs text-[var(--text-muted)]">
            <strong className="text-[var(--text-primary)]">Disclaimer:</strong> NyayaLens provides educational and informational assistance for understanding everyday legal documents. It does not provide formal legal advice. For contentious disputes or major obligations, always consult a licensed advocate.
          </p>
        </div>

        {/* Unobtrusive Connectivity & Debug Drawer */}
        <div className="pt-6 border-t border-[var(--bg-surface-raised)] flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowHealthcheck(!showHealthcheck)}
            className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1.5 transition cursor-pointer"
          >
            <span>{showHealthcheck ? '▲ Hide System Diagnostics' : '▼ Developer Diagnostics & API Healthcheck'}</span>
          </button>

          {showHealthcheck && (
            <div className="w-full max-w-md mt-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] space-y-3 animate-in fade-in zoom-in-95 duration-200 text-center shadow-xl">
              <div className="text-xs text-[var(--text-muted)] font-medium">Gemini Connectivity Verification</div>
              <button
                id="test-gemini-btn"
                onClick={checkHealth}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[var(--bg-surface-raised)] bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] text-[var(--text-primary)] text-xs font-medium transition cursor-pointer"
              >
                {loading ? 'Calling Gemini...' : 'Run Connectivity Check'}
              </button>

              {result && (
                <div
                  id="healthcheck-result"
                  className="rounded-lg bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 p-3 text-left space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-[var(--accent-bright)] font-semibold uppercase">
                    <span>Status: Verified</span>
                    {result.model && <span className="opacity-80">{result.model}</span>}
                  </div>
                  <div className="text-sm font-mono font-bold text-[var(--text-primary)]">
                    {result.text}
                  </div>
                </div>
              )}

              {error && (
                <div
                  id="healthcheck-error"
                  className="rounded-lg bg-rose-950/30 border border-rose-500/30 p-3 text-left space-y-1 text-xs text-rose-300"
                >
                  <div className="font-semibold text-rose-400">Error:</div>
                  <div className="font-mono">{error}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
