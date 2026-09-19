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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 backdrop-blur-xl rounded-2xl p-8 shadow-2xl shadow-indigo-950/40 text-center space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium tracking-wide uppercase mb-3">
            PromptWars Setup
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            NyayaLens
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Self-verifying AI legal co-pilot for Indian legal documents
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Link
            id="go-to-analyze-link"
            href="/analyze"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:from-blue-700 active:to-indigo-700 text-white font-medium shadow-lg shadow-blue-600/20 transition cursor-pointer text-sm"
          >
            <span>Single Document Analysis &rarr;</span>
          </Link>

          <Link
            id="go-to-compare-link"
            href="/compare"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:from-indigo-700 active:to-violet-700 text-white font-medium shadow-lg shadow-indigo-600/30 transition cursor-pointer text-sm"
          >
            <span>Compare Documents (Diff Mode) &rarr;</span>
          </Link>

          <button
            id="test-gemini-btn"
            onClick={checkHealth}
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer text-xs"
          >
            {loading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Calling Gemini...</span>
              </>
            ) : (
              <span>Test Gemini Connectivity</span>
            )}
          </button>
        </div>

        {/* Display Output */}
        {result && (
          <div
            id="healthcheck-result"
            className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-4 text-left space-y-2 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold uppercase tracking-wider">
              <span>Status: Verified</span>
              {result.model && <span className="opacity-70">{result.model}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Response:</span>
              <span
                id="gemini-response-text"
                className="text-2xl font-mono font-bold text-emerald-300 tracking-wider"
              >
                {result.text}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            id="healthcheck-error"
            className="rounded-xl bg-rose-950/40 border border-rose-500/30 p-4 text-left space-y-1 animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="text-xs text-rose-400 font-semibold uppercase tracking-wider">
              Error Connecting to Gemini
            </div>
            <p className="text-xs font-mono text-rose-300 break-words">{error}</p>
          </div>
        )}

        <div className="text-xs text-slate-500 pt-2 border-t border-slate-800/80">
          Day 1 Connectivity Verification &bull; Phase 1 Setup
        </div>
      </div>
    </main>
  );
}
