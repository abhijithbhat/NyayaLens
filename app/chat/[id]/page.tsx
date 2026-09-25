'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ParsedDocument,
  Clause,
  ChatMessage,
  ClauseEmbedding,
  VerificationStatus,
} from '@/lib/types';
import AppHeader from '@/components/AppHeader';
import { VerificationBadge } from '@/components/StatusBadges';

const SAMPLE_DOCS: Record<string, { filename: string; jsonPath: string }> = {
  'doc-rental-agreement-a': {
    filename: 'sample_rental_agreement.pdf',
    jsonPath: '/samples/parsed_docA.json',
  },
  'doc-rental-agreement-b': {
    filename: 'sample_rental_agreement_v2.pdf',
    jsonPath: '/samples/parsed_docB.json',
  },
};

const STARTER_PROMPTS = [
  'What is the monthly rent amount, when is it due, and what is the late penalty fee?',
  'What is the security deposit amount and what are the exact refund conditions?',
  'What is the lock-in period and how much advance notice is required to terminate?',
  'Are domestic pets allowed in this property and are there any pet fines?',
];

export default function DocumentChatPage() {
  const params = useParams();
  const docId = (params?.id as string) || 'doc-rental-agreement-a';

  const [document, setDocument] = useState<ParsedDocument | null>(null);
  const [clauseEmbeddings, setClauseEmbeddings] = useState<ClauseEmbedding[]>([]);
  const [loadingDoc, setLoadingDoc] = useState(true);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedRetrievedClauses, setSelectedRetrievedClauses] = useState<Clause[]>([]);
  const [activeCitedClause, setActiveCitedClause] = useState<Clause | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Load document on mount or param change
  useEffect(() => {
    async function loadDoc() {
      setLoadingDoc(true);
      try {
        // 1. Check session storage for user-uploaded parsed documents
        const cachedSession = sessionStorage.getItem(`nyayalens_doc_${docId}`);
        if (cachedSession) {
          const parsed: ParsedDocument = JSON.parse(cachedSession);
          setDocument(parsed);
          setLoadingDoc(false);
          return;
        }

        // 2. Fallback to sample document JSON
        const sample = SAMPLE_DOCS[docId] || SAMPLE_DOCS['doc-rental-agreement-a'];
        // Try to fetch bundled sample data
        const sampleDataA = await import('@/samples/parsed_docA.json');
        const sampleDataB = await import('@/samples/parsed_docB.json');

        const docData = docId.includes('v2') || docId.includes('agreement-b')
          ? (sampleDataB.default as ParsedDocument)
          : (sampleDataA.default as ParsedDocument);

        setDocument(docData);

        // Preload cached embeddings if available for sample doc A
        if (docId === 'doc-rental-agreement-a') {
          try {
            const cachedEmb = await import('@/samples/embeddings_docA.json');
            if (Array.isArray(cachedEmb.default)) {
              setClauseEmbeddings(cachedEmb.default as ClauseEmbedding[]);
            }
          } catch {
            // Optional optimization
          }
        }
      } catch (err) {
        console.error('Failed to load document data:', err);
      } finally {
        setLoadingDoc(false);
      }
    }

    loadDoc();
  }, [docId]);

  async function handleSendMessage(queryToSend?: string) {
    const query = (queryToSend || inputQuery).trim();
    if (!query || isStreaming || !document) return;

    setInputQuery('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `asst-${Date.now()}`;

    // Add user message
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: query,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Add placeholder assistant message
    const initialAssistantMsg: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document,
          question: query,
          clauseEmbeddings,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Chat API request failed (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === 'retrieval') {
              if (Array.isArray(event.retrievedClauses)) {
                setSelectedRetrievedClauses(event.retrievedClauses);
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMsgId
                      ? { ...msg, retrievedClauses: event.retrievedClauses }
                      : msg
                  )
                );
              }
              if (Array.isArray(event.embeddings) && event.embeddings.length > 0) {
                setClauseEmbeddings(event.embeddings);
              }
            } else if (event.type === 'token') {
              accumulatedContent += event.content;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                )
              );
            } else if (event.type === 'verification') {
              // Post-stream verification arrived!
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        verification: event.verification,
                        citedClauseIds: event.citedClauseIds,
                      }
                    : msg
                )
              );
            } else if (event.type === 'error') {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? {
                        ...msg,
                        content: msg.content + `\n\n⚠️ Error: ${event.message}`,
                        verification: {
                          status: 'needs_review',
                          details: event.message,
                        },
                      }
                    : msg
                )
              );
            }
          } catch (pErr) {
            console.warn('Error parsing SSE event:', pErr, jsonStr);
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error during response streaming';
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content: msg.content + `\n\n⚠️ Communication error: ${errMsg}`,
                verification: { status: 'needs_review', details: errMsg },
              }
            : msg
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    handleSendMessage();
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col selection:bg-[var(--accent-primary)] selection:text-white">
      {/* Unified App Header */}
      <AppHeader activeDocId={document?.id || docId} />

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
        {/* Left 8 Cols: Chat Feed & Input */}
        <div className="lg:col-span-8 flex flex-col h-[calc(100vh-130px)] bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl overflow-hidden shadow-2xl">
          {/* Active Document Sub-Header */}
          <div className="px-5 py-3 border-b border-[var(--bg-surface-raised)] bg-[var(--bg-surface)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--accent-bright)] shadow-[0_0_6px_var(--accent-bright)]"></span>
              <span id="chat-header-title" className="text-xs font-semibold text-[var(--text-primary)] font-display truncate max-w-xs sm:max-w-md">
                {document?.filename || 'Loading Document...'}
              </span>
              {document && (
                <span className="text-[11px] bg-[var(--bg-surface-raised)] text-[var(--text-muted)] px-2 py-0.5 rounded border border-[var(--bg-surface-raised)]">
                  {document.clauses.length} Clauses Ingested
                </span>
              )}
            </div>

            {/* Document Switcher / Demo Toggle */}
            <div className="flex items-center gap-2 text-xs">
              <Link
                href="/chat/doc-rental-agreement-a"
                className={`px-2 py-1 rounded text-[11px] transition ${
                  docId === 'doc-rental-agreement-a'
                    ? 'bg-[var(--accent-primary)] text-white font-medium'
                    : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Agreement v1
              </Link>
              <Link
                href="/chat/doc-rental-agreement-b"
                className={`px-2 py-1 rounded text-[11px] transition ${
                  docId === 'doc-rental-agreement-b'
                    ? 'bg-[var(--accent-primary)] text-white font-medium'
                    : 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                Agreement v2
              </Link>
            </div>
          </div>

          {/* Messages Feed */}
          <div id="chat-messages-container" className="flex-1 overflow-y-auto p-5 space-y-5">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-6">
                <div className="w-14 h-14 rounded-2xl bg-[var(--accent-primary)]/15 border border-[var(--accent-primary)]/30 flex items-center justify-center text-[var(--accent-bright)] shadow-inner">
                  <svg className="w-7 h-7" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.75"
                      d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                    />
                  </svg>
                </div>
                <div className="max-w-md space-y-2">
                  <h3 className="font-semibold text-base text-[var(--text-primary)] font-display">
                    Ask Questions Grounded in Your Agreement
                  </h3>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    NyayaLens retrieves the exact relevant clauses, streams an accurate plain-English answer,
                    and independently verifies every figure and statement before confirming it.
                  </p>
                </div>

                {/* Starter Prompt Chips */}
                <div className="w-full max-w-lg space-y-2 text-left">
                  <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block">
                    Suggested Questions:
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {STARTER_PROMPTS.map((prompt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSendMessage(prompt)}
                        className="text-left p-2.5 rounded-xl bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] hover:border-[var(--accent-primary)]/40 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition flex items-center justify-between group cursor-pointer"
                      >
                        <span className="truncate pr-2">{prompt}</span>
                        <span className="text-[var(--accent-bright)] opacity-0 group-hover:opacity-100 transition">
                          &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const hasVerif = Boolean(msg.verification);
                const isVerified = msg.verification?.status === 'verified';

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                  >
                    {/* Message Bubble */}
                    <div
                      className={`max-w-[88%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-lg ${
                        isUser
                          ? 'bg-[var(--accent-primary)] text-white rounded-br-none shadow-md'
                          : 'bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] text-[var(--text-primary)] rounded-bl-none'
                      }`}
                      aria-live={!isUser ? 'polite' : undefined}
                      aria-atomic={false}
                    >
                      <div className="whitespace-pre-wrap">{msg.content}</div>

                      {/* Blinking cursor during live streaming */}
                      {!isUser && isStreaming && msg === messages[messages.length - 1] && (
                        <span className="inline-block w-1.5 h-3.5 bg-[var(--accent-bright)] ml-1 animate-pulse align-middle" aria-hidden="true" />
                      )}
                    </div>


                    {/* Assistant Metadata & Verification Badges */}
                    {!isUser && (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 px-1">
                        {/* Verification Status Badge */}
                        {hasVerif && (
                          <VerificationBadge
                            status={msg.verification?.status || 'needs_review'}
                            label={
                              isVerified
                                ? `Dual-Gate Verified (${Math.round((msg.verification?.confidence || 1) * 100)}%)`
                                : 'Needs Review • Unverified'
                            }
                            details={msg.verification?.details}
                          />
                        )}

                        {/* Cited Clause Tags */}
                        {msg.citedClauseIds && msg.citedClauseIds.length > 0 && (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-[var(--text-muted)]">Cited:</span>
                            {msg.citedClauseIds.map((cid) => {
                              const found = document?.clauses.find((c) => c.id === cid);
                              return (
                                <button
                                  key={cid}
                                  type="button"
                                  onClick={() => found && setActiveCitedClause(found)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-base)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--bg-surface-raised)] font-mono transition cursor-pointer"
                                >
                                  {found?.sectionNumber || cid}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={handleFormSubmit}
            className="p-3 border-t border-[var(--bg-surface-raised)] bg-[var(--bg-surface)] flex items-center gap-2"
          >
            <input
              type="text"
              id="chat-query-input"
              aria-label="Ask a question about this contract"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask a question about this contract (e.g. rent, deposit, termination)..."
              disabled={isStreaming || loadingDoc}
              className="flex-1 bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] rounded-xl px-4 py-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-primary)] transition"
            />
            <button
              type="submit"
              id="chat-submit-btn"
              disabled={!inputQuery.trim() || isStreaming || loadingDoc}
              aria-label={isStreaming ? "Generating answer..." : "Submit question"}
              className="px-4 py-2.5 rounded-xl bg-[var(--accent-primary)] hover:bg-[var(--accent-bright)] active:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium shadow-md shadow-[var(--accent-primary)]/20 transition flex items-center gap-1.5 cursor-pointer"
            >
              {isStreaming ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5 text-white" aria-hidden="true" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Answering...</span>
                </>
              ) : (
                <span>Ask</span>
              )}
            </button>
          </form>
        </div>

        {/* Right 4 Cols: Retrieved Source Clauses & Citation Inspector */}
        <div className="lg:col-span-4 flex flex-col h-[calc(100vh-130px)] bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-4 py-3 border-b border-[var(--bg-surface-raised)] bg-[var(--bg-surface)] flex items-center justify-between">
            <h3 className="font-semibold text-xs text-[var(--text-primary)] font-display flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[var(--accent-bright)]" aria-hidden="true" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Retrieved Evidence</span>
            </h3>
            <span className="text-[10px] text-[var(--text-muted)]">Semantic Top-5</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Modal/Detail for clicked active cited clause */}
            {activeCitedClause && (
              <div className="p-3 rounded-xl bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 space-y-1.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--accent-bright)]">
                    Inspecting: {activeCitedClause.sectionNumber || activeCitedClause.heading}
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveCitedClause(null)}
                    aria-label="Close clause detail"
                    className="text-xs text-[var(--accent-bright)] hover:text-white cursor-pointer"
                  >
                    ×
                  </button>
                </div>

                <p className="text-xs text-[var(--text-primary)] leading-relaxed font-mono whitespace-pre-wrap bg-[var(--bg-base)] p-2.5 rounded-lg border border-[var(--bg-surface-raised)]">
                  {activeCitedClause.rawText}
                </p>
              </div>
            )}

            {selectedRetrievedClauses.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-[var(--text-muted)] text-xs space-y-2">
                <p>No query submitted yet.</p>
                <p className="text-[11px] text-[var(--text-muted)]/75">
                  When you ask a question, the top 5 relevant clauses matching your question's embedding will appear here.
                </p>
              </div>
            ) : (
              selectedRetrievedClauses.map((clause, idx) => (
                <div
                  key={clause.id}
                  className="p-3 rounded-xl bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] hover:border-[var(--accent-primary)]/40 space-y-1.5 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate max-w-[180px]">
                      {clause.sectionNumber ? `${clause.sectionNumber} - ` : ''}
                      {clause.heading}
                    </span>
                    <span className="text-[10px] bg-[var(--accent-primary)]/10 text-[var(--accent-bright)] border border-[var(--accent-primary)]/25 px-1.5 py-0.5 rounded">
                      Rank #{idx + 1}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] line-clamp-3 leading-relaxed">
                    {clause.rawText}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveCitedClause(clause)}
                    className="text-[10px] text-[var(--accent-bright)] hover:underline font-medium cursor-pointer"
                  >
                    View Full Clause &rarr;
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
