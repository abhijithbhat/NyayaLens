'use client';

import { Language } from '@/lib/types';

interface LanguageSelectorProps {
  value: Language;
  onChange: (lang: Language) => void;
  disabled?: boolean;
}

export default function LanguageSelector({ value, onChange, disabled }: LanguageSelectorProps) {
  const languages: { code: Language; label: string; native: string }[] = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिंदी' },
    { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
  ];

  return (
    <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800/90 shadow-sm">
      <span className="text-[11px] text-slate-400 font-medium px-2 hidden sm:inline select-none">Language:</span>
      {languages.map((lang) => (
        <button
          key={lang.code}
          type="button"
          disabled={disabled}
          onClick={() => onChange(lang.code)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
            value === lang.code
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 disabled:opacity-50'
          }`}
          title={lang.label}
        >
          {lang.native}
        </button>
      ))}
    </div>
  );
}
