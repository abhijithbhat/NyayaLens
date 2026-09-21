'use client';

import { useState } from 'react';
import Link from 'next/link';

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              NL
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-100 tracking-tight">NyayaLens</span>
                <span className="text-[10px] uppercase tracking-wider bg-indigo-500/10 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-semibold">
                  Dual-Gate Verified
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Self-Verifying Legal Co-Pilot for Indian Documents</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              id="nav-analyze-link"
              href="/analyze"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Analyze
            </Link>
            <Link
              id="nav-compare-link"
              href="/compare"
              className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Compare
            </Link>
            <Link
              id="nav-chat-link"
              href="/chat/doc-rental-agreement-a"
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 transition-colors font-medium"
            >
              Chat Q&A
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 space-y-12">
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium tracking-wide">
            <span>🛡️ Never Trust an Unverified AI Legal Claim</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent leading-tight">
            Self-Verifying AI Legal Co-Pilot for Indian Contracts
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed max-w-2xl mx-auto">
            NyayaLens ingests everyday rental agreements, employment offers, and service contracts.
            Every generated simplification, risk flag, comparison diff, and Q&A answer is verified against
            the document’s source text before you see it. If a claim cannot be verified, NyayaLens abstains.
          </p>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Gate 1: Lexical &amp; Numerical Overlap
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
              Gate 2: Impartial LLM-Judge
            </span>
            <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-800 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
              Strict Abstention on Low Confidence
            </span>
          </div>
        </div>

        {/* The Three Modes: Primary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          {/* Mode 1: Single Document Analysis */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-blue-500/40 p-6 flex flex-col justify-between space-y-5 transition-all group shadow-xl hover:shadow-blue-900/10">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-100 group-hover:text-blue-300 transition-colors">
                1. Single Document Analysis
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Clause-by-clause plain-language simplification, risk severity classification, and numerical grounding with exact source citations.
              </p>
            </div>

            <Link
              id="go-to-analyze-link"
              href="/analyze"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-medium text-xs shadow-lg shadow-blue-600/20 transition cursor-pointer"
            >
              <span>Analyze Document &rarr;</span>
            </Link>
          </div>

          {/* Mode 2: Compare Contracts */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-indigo-500/40 p-6 flex flex-col justify-between space-y-5 transition-all group shadow-xl hover:shadow-indigo-900/10">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-100 group-hover:text-indigo-300 transition-colors">
                2. Contract Comparison (Diff)
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Structured clause alignment across two contract versions, showing which side each substantive change favors, plus unique and omitted clauses.
              </p>
            </div>

            <Link
              id="go-to-compare-link"
              href="/compare"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <span>Compare Contracts &rarr;</span>
            </Link>
          </div>

          {/* Mode 3: Grounded Chat Q&A */}
          <div className="rounded-2xl bg-slate-900/70 border border-slate-800 hover:border-emerald-500/40 p-6 flex flex-col justify-between space-y-5 transition-all group shadow-xl hover:shadow-emerald-900/10">
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-100 group-hover:text-emerald-300 transition-colors">
                3. Grounded Chat Q&amp;A
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Interactive question-answering with semantic clause retrieval, live streaming tokens, and post-stream dual-gate verification.
              </p>
            </div>

            <Link
              id="go-to-chat-link"
              href="/chat/doc-rental-agreement-a"
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-medium text-xs shadow-lg shadow-emerald-600/20 transition cursor-pointer"
            >
              <span>Start Contract Q&A &rarr;</span>
            </Link>
          </div>
        </div>

        {/* Informational Disclaimer Banner */}
        <div className="rounded-xl bg-slate-900/50 border border-slate-800/80 p-4 text-center space-y-1">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-300">Disclaimer:</strong> NyayaLens provides educational and informational assistance for understanding everyday legal documents. It does not provide formal legal advice. For contentious disputes or major obligations, always consult a licensed advocate.
          </p>
        </div>

        {/* Unobtrusive Connectivity & Debug Drawer */}
        <div className="pt-6 border-t border-slate-800/60 flex flex-col items-center">
          <button
            type="button"
            onClick={() => setShowHealthcheck(!showHealthcheck)}
            className="text-[11px] text-slate-400 hover:text-slate-300 flex items-center gap-1.5 transition"
          >
            <span>{showHealthcheck ? '▲ Hide System Diagnostics' : '▼ Developer Diagnostics & API Healthcheck'}</span>
          </button>

          {showHealthcheck && (
            <div className="w-full max-w-md mt-4 p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 animate-in fade-in zoom-in-95 duration-200 text-center">
              <div className="text-xs text-slate-400">Gemini Connectivity Verification</div>
              <button
                id="test-gemini-btn"
                onClick={checkHealth}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                {loading ? 'Calling Gemini...' : 'Run Connectivity Check'}
              </button>

              {result && (
                <div
                  id="healthcheck-result"
                  className="rounded-lg bg-emerald-950/40 border border-emerald-500/30 p-3 text-left space-y-1"
                >
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 font-semibold uppercase">
                    <span>Status: Verified</span>
                    {result.model && <span className="opacity-70">{result.model}</span>}
                  </div>
                  <div className="text-sm font-mono font-bold text-emerald-300">
                    {result.text}
                  </div>
                </div>
              )}

              {error && (
                <div
                  id="healthcheck-error"
                  className="rounded-lg bg-rose-950/40 border border-rose-500/30 p-3 text-left space-y-1 text-xs text-rose-300"
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
