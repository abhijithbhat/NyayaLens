'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bare /chat route handler.
 * Per specification: when accessed with no document ID, it gracefully redirects
 * to /analyze with an invitation to upload or select a document to interrogate,
 * preventing dead-ends or empty states.
 */
export default function ChatIndexPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeDocId = sessionStorage.getItem('nyayalens_active_doc_id');
      if (activeDocId) {
        router.replace(`/chat/${activeDocId}`);
        return;
      }
    }
    // No active document: redirect to /analyze with informative notice
    router.replace('/analyze?notice=chat_requires_document');
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center p-6 text-center">
      <div className="flex items-center gap-3 text-[var(--accent-bright)]">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm font-medium">Redirecting to Document Ingestion...</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] mt-2">
        Grounded Q&amp;A requires an ingested agreement to verify facts against.
      </p>
    </div>
  );
}
