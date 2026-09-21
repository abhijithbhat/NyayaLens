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

  const chatHref = activeDocId ? `/chat/${activeDocId}` : '/chat/doc-rental-agreement-a';
  const compareHref = activeDocId ? `/compare?docA=${activeDocId}` : '/compare';

  return (
    <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
        {/* Logo and Brand */}
        <Link href="/" className="flex items-center space-x-3 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
            NL
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-slate-100 group-hover:text-indigo-300 transition-colors">
                NyayaLens
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                Dual-Gate Verified
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Self-Verifying Legal Co-Pilot for Indian Agreements
            </p>
          </div>
        </Link>

        {/* Navigation Tabs & Extra Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <nav className="flex items-center gap-1 sm:gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80">
            <Link
              id="header-nav-home"
              href="/"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isHome
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Home
            </Link>
            <Link
              id="header-nav-analyze"
              href="/analyze"
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isAnalyze
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Analyze
            </Link>
            <Link
              id="header-nav-compare"
              href={compareHref}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isCompare
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              Compare
            </Link>
            <Link
              id="header-nav-chat"
              href={chatHref}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                isChat
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
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
