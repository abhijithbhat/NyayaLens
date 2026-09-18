'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { Clause, ParsedDocument, ParseApiResponse, ClauseCategory } from '@/lib/types';

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CATEGORY_COLORS: Record<string, string> = {
  Payment: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Termination: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  Liability: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Deposit: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Notice: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Other: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
};

export default function AnalyzePage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [documentData, setDocumentData] = useState<ParsedDocument | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    setError(null);
    if (!e.target.files || e.target.files.length === 0) {
      setFile(null);
      return;
    }

    const selectedFile = e.target.files[0];

    // Client-side file type check
    const extension = '.' + selectedFile.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setError(
        `Unsupported file type "${extension}". Please select a PDF or image file (.pdf, .png, .jpg, .jpeg, .webp).`
      );
      setFile(null);
      return;
    }

    // Client-side file size check
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
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error occurred during upload.');
    } finally {
      setLoading(false);
    }
  }

  // Category counts
  const categoryCounts: Record<string, number> = {};
  if (documentData) {
    documentData.clauses.forEach((c) => {
      const cat = c.category || 'Other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 selection:bg-indigo-500 selection:text-white">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                Phase 2 Ingestion
              </span>
              <span className="text-xs text-slate-500">Native Multimodal Gemini Parsing</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white mt-1">
              Document Ingestion & Clause Segmentation
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Upload a legal contract (PDF or image). Gemini extracts verbatim clauses and assigns standardized categories.
            </p>
          </div>
          <Link
            href="/"
            className="text-xs font-medium text-slate-400 hover:text-white px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
          >
            &larr; Back to Setup
          </Link>
        </div>

        {/* Upload Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 space-y-5 shadow-xl"
        >
          <div>
            <label
              htmlFor="document-file-input"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Select Legal Document (PDF, PNG, JPG, WebP &bull; Max 10MB)
            </label>
            <input
              id="document-file-input"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
              onChange={handleFileChange}
              disabled={loading}
              className="w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 file:cursor-pointer bg-slate-950/60 rounded-xl border border-slate-800 p-2 cursor-pointer focus:outline-none focus:border-indigo-500"
            />
            {file && (
              <p className="text-xs text-slate-400 mt-2">
                Selected: <span className="font-mono text-slate-200">{file.name}</span> (
                {(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              id="parse-submit-btn"
              type="submit"
              disabled={!file || loading}
              className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:bg-indigo-900/40 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-medium shadow-md shadow-indigo-600/20 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
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
                  <span>Segmenting clauses with Gemini...</span>
                </>
              ) : (
                <span>Upload & Ingest Document</span>
              )}
            </button>
            {loading && (
              <span className="text-xs text-slate-400 animate-pulse">
                Parsing document structure and enforcing schema...
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
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>Ingestion Error</span>
            </div>
            <p className="text-xs font-mono break-words pl-6">{error}</p>
          </div>
        )}

        {/* Results View */}
        {documentData && (
          <div id="parsed-results-container" className="space-y-6 animate-in fade-in">
            {/* Summary Bar */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs text-slate-400">Document Name</span>
                <p className="font-mono text-sm text-white font-medium">{documentData.filename}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400">Total Clauses Extracted</span>
                <p id="clause-count-display" className="text-xl font-bold text-indigo-400">
                  {documentData.clauses.length}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {Object.entries(categoryCounts).map(([category, count]) => (
                  <span
                    key={category}
                    className={`text-xs px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[category] || CATEGORY_COLORS.Other}`}
                  >
                    {category}: {count}
                  </span>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  {showRawJson ? 'Hide Raw JSON' : 'View Raw JSON'}
                </button>
              </div>
            </div>

            {/* Raw JSON viewer */}
            {showRawJson && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 overflow-x-auto text-xs font-mono text-slate-300 max-h-96">
                <pre id="raw-json-output">{JSON.stringify(documentData.clauses, null, 2)}</pre>
              </div>
            )}

            {/* Clauses List */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Extracted Clauses</h2>
              <div className="space-y-3" id="clauses-list">
                {documentData.clauses.map((clause, idx) => (
                  <div
                    key={clause.id || idx}
                    className="clause-card bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-3 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {clause.sectionNumber && (
                          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                            {clause.sectionNumber}
                          </span>
                        )}
                        <h3 className="font-semibold text-white text-base">{clause.heading}</h3>
                      </div>
                      <span
                        className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${CATEGORY_COLORS[clause.category] || CATEGORY_COLORS.Other}`}
                      >
                        {clause.category}
                      </span>
                    </div>
                    <div className="bg-slate-950/80 rounded-lg p-3.5 border border-slate-800/50">
                      <p className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap">
                        {clause.rawText}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
