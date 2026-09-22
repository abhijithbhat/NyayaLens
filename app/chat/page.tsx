'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
    router.replace('/chat/doc-rental-agreement-a');
  }, [router]);

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
      <div className="flex items-center gap-3 text-[var(--accent-bright)]">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="text-sm font-medium">Opening Contract Q&amp;A...</span>
      </div>
    </div>
  );
}
