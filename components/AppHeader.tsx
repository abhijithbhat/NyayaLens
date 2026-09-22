'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AppHeaderProps {
  activeDocId?: string;
  extraControls?: React.ReactNode;
}

export default function AppHeader({ activeDocId, extraControls }: AppHeaderProps) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isAnalyze = pathname?.startsWith('/analyze');
  const isCompare = pathname?.startsWith('/compare');
  const isChat = pathname?.startsWith('/chat');

  const chatHref = activeDocId ? `/chat/${activeDocId}` : '/analyze';
  const compareHref = activeDocId ? `/compare?docA=${activeDocId}` : '/compare';

  return (
    <header className="border-b border-[var(--bg-surface-raised)] bg-[var(--bg-surface)]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-primary)] to-[var(--accent-bright)] flex items-center justify-center font-bold text-white shadow-lg shadow-[var(--accent-primary)]/25 group-hover:scale-105 transition-transform font-display">
            NL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-[var(--text-primary)] group-hover:text-[var(--accent-bright)] transition-colors font-display">
                NyayaLens
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)]">
                Dual-Gate Verified
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)] hidden sm:block">
              Self-Verifying Legal Co-Pilot for Indian Agreements
            </p>
          </div>
        </Link>

        {/* Navigation Tabs & Extra Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <nav className="flex items-center gap-1 sm:gap-1.5 bg-[var(--bg-base)]/90 p-1 rounded-xl border border-[var(--bg-surface-raised)]">
            <Link
              id="header-nav-home"
              href="/"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isHome
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
              }`}
            >
              Home
            </Link>
            <Link
              id="header-nav-analyze"
              href="/analyze"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isAnalyze
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
              }`}
            >
              Analyze
            </Link>
            <Link
              id="header-nav-compare"
              href={compareHref}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isCompare
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
              }`}
            >
              Compare
            </Link>
            <Link
              id="header-nav-chat"
              href={chatHref}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isChat
                  ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-raised)]'
              }`}
            >
              Chat Q&amp;A
            </Link>
          </nav>

          {extraControls && <div className="flex items-center gap-2">{extraControls}</div>}
        </div>
      </div>
    </header>
  );
}
