'use client';

import { useState } from 'react';
import { ChecklistItem, Language } from '@/lib/types';

interface ChecklistViewProps {
  items: ChecklistItem[];
  language?: Language;
  onToggleItem?: (itemId: string) => void;
  isLoading?: boolean;
  onRegenerate?: () => void;
  title?: string;
  subtitle?: string;
}

export default function ChecklistView({
  items,
  language = 'en',
  onToggleItem,
  isLoading = false,
  onRegenerate,
  title = 'Pre-Signing Checklist & Next Steps',
  subtitle = 'Actionable items & advocate inquiries filtered strictly from medium/high risk or unverified terms.',
}: ChecklistViewProps) {
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [copiedSection, setCopiedSection] = useState<'lawyer' | 'all' | null>(null);

  const completedCount = items.filter((item) => item.completed).length;
  const totalCount = items.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const lawyerItems = items.filter((item) => item.lawyerQuestion && item.lawyerQuestion.trim().length > 0);

  const displayedItems = items.filter((item) => {
    if (filter === 'pending') return !item.completed;
    if (filter === 'completed') return !!item.completed;
    return true;
  });

  const langLabels = {
    en: {
      badge: 'Action Checklist',
      lawyerSectionTitle: 'Questions for Your Legal Advocate',
      lawyerSectionSub: 'Sharper statutory questions drafted for high-severity liabilities or unverified clauses.',
      emptyTitle: 'No High or Medium Risk Items Found',
      emptySub: 'All analyzed terms appear standard, or all items have passed verification with low risk.',
      copyLawyer: 'Copy Lawyer Questions',
      copyAll: 'Copy Entire Checklist',
      copied: 'Copied!',
    },
    hi: {
      badge: 'कार्य सूची (चेकलिस्ट)',
      lawyerSectionTitle: 'अपने कानूनी सलाहकार (वकील) से पूछने योग्य प्रश्न',
      lawyerSectionSub: 'उच्च जोखिम और असत्यापित शर्तों के लिए विशेष कानूनी प्रश्न।',
      emptyTitle: 'कोई उच्च या मध्यम जोखिम वाले खंड नहीं मिले',
      emptySub: 'सभी विश्लेषित शर्तें सामान्य पाई गई हैं।',
      copyLawyer: 'वकील के प्रश्न कॉपी करें',
      copyAll: 'पूरी सूची कॉपी करें',
      copied: 'कॉपी हो गया!',
    },
    kn: {
      badge: 'ಕ್ರಿಯಾ ಪರಿಶೀಲನಾ ಪಟ್ಟಿ',
      lawyerSectionTitle: 'ನಿಮ್ಮ ವಕೀಲರನ್ನು ಕೇಳಬೇಕಾದ ಪ್ರಶ್ನೆಗಳು',
      lawyerSectionSub: 'ಹೆಚ್ಚಿನ ಅಪಾಯ ಮತ್ತು ಪರಿಶೀಲನೆಗೆ ಒಳಪಡದ ಷರತ್ತುಗಳಿಗಾಗಿ ಸೂಕ್ತ ಕಾನೂನು ಪ್ರಶ್ನೆಗಳು.',
      emptyTitle: 'ಯಾವುದೇ ಹೆಚ್ಚಿನ ಅಥವಾ ಮಧ್ಯಮ ಅಪಾಯದ ಷರತ್ತುಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
      emptySub: 'ಎಲ್ಲಾ ನಿಯಮಗಳು ಸಾಮಾನ್ಯ ಮತ್ತು ಸುರಕ್ಷಿತವಾಗಿ ಕಂಡುಬಂದಿವೆ.',
      copyLawyer: 'ವಕೀಲರ ಪ್ರಶ್ನೆಗಳನ್ನು ನಕಲಿಸಿ',
      copyAll: 'ಪೂರ್ಣ ಪಟ್ಟಿಯನ್ನು ನಕಲಿಸಿ',
      copied: 'ನಕಲಿಸಲಾಗಿದೆ!',
    },
  }[language];

  function copyToClipboard(text: string, section: 'lawyer' | 'all') {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2500);
  }

  function handleCopyLawyerQuestions() {
    const text = lawyerItems
      .map(
        (item, idx) =>
          `${idx + 1}. [${item.clauseHeading || 'Clause'}] (Risk: ${item.severity.toUpperCase()})\nQuestion: ${item.lawyerQuestion}`
      )
      .join('\n\n');
    copyToClipboard(text, 'lawyer');
  }

  function handleCopyAllChecklist() {
    const text = items
      .map((item, idx) => {
        let block = `${idx + 1}. [${item.clauseHeading || 'Clause'}] [${item.completed ? 'COMPLETED' : 'PENDING'}]\nAction: ${item.checklistAction}`;
        if (item.lawyerQuestion) {
          block += `\nLawyer Question: ${item.lawyerQuestion}`;
        }
        return block;
      })
      .join('\n\n');
    copyToClipboard(text, 'all');
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              {langLabels.badge}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              {items.length} {items.length === 1 ? 'Action Item' : 'Action Items'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1.5">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Progress & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {totalCount > 0 && (
            <div className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-mono font-medium text-slate-300">
                {completedCount}/{totalCount} ({progressPct}%)
              </span>
            </div>
          )}

          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Regenerating...' : 'Regenerate'}
            </button>
          )}

          {totalCount > 0 && (
            <button
              onClick={handleCopyAllChecklist}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              {copiedSection === 'all' ? langLabels.copied : langLabels.copyAll}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs if items exist */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs border-b border-slate-800/60 pb-3">
          <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'pending' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Pending ({totalCount - completedCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'completed' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Completed ({completedCount})
            </button>
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-300 font-medium">Generating checklist &amp; lawyer questions...</p>
          <p className="text-xs text-slate-500">Synthesizing verified terms and drafting legal questions</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="py-10 px-6 rounded-xl bg-slate-950/40 border border-slate-800/80 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center font-bold text-lg">
            ✓
          </div>
          <h3 className="text-sm font-semibold text-slate-200">{langLabels.emptyTitle}</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{langLabels.emptySub}</p>
        </div>
      )}

      {/* Checklist Items List */}
      {!isLoading && displayedItems.length > 0 && (
        <div className="space-y-3.5">
          {displayedItems.map((item) => {
            const isHigh = item.severity === 'high';
            const isReview = item.verificationStatus === 'needs_review';

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.completed
                    ? 'bg-slate-950/30 border-slate-800/50 opacity-60'
                    : isHigh
                    ? 'bg-rose-950/10 border-rose-500/30 hover:border-rose-500/50'
                    : isReview
                    ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Interactive Checkbox */}
                  <button
                    type="button"
                    onClick={() => onToggleItem && onToggleItem(item.id)}
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-all ${
                      item.completed
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : 'border-slate-600 bg-slate-900 hover:border-indigo-400'
                    }`}
                    aria-label={`Mark ${item.clauseHeading} completed`}
                  >
                    {item.completed && <span className="text-xs font-bold leading-none">✓</span>}
                  </button>

                  <div className="flex-1 space-y-2">
                    {/* Header line: Title & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            item.completed ? 'line-through text-slate-400' : 'text-slate-100'
                          }`}
                        >
                          {item.clauseHeading || 'Clause'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">ID: {item.clauseId}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Severity Badge */}
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            item.severity === 'high'
                              ? 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                              : item.severity === 'medium'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              : 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                          }`}
                        >
                          {item.severity.toUpperCase()} RISK
                        </span>

                        {/* Verification Badge */}
                        {item.verificationStatus === 'verified' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                            Dual-Gate Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                            Needs Review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pre-signing Action */}
                    <p
                      className={`text-sm leading-relaxed ${
                        item.completed ? 'line-through text-slate-400' : 'text-slate-200'
                      }`}
                    >
                      <strong className="text-indigo-300 font-medium">Action: </strong>
                      {item.checklistAction}
                    </p>

                    {/* Lawyer Question Callout for High Severity or Needs Review */}
                    {item.lawyerQuestion && item.lawyerQuestion.trim().length > 0 && (
                      <div className="mt-2.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/25 flex items-start gap-2.5 text-xs text-amber-200">
                        <span className="text-base select-none">⚖️</span>
                        <div className="space-y-0.5">
                          <span className="font-semibold text-amber-300 uppercase tracking-wider text-[10px]">
                            Question for Your Lawyer:
                          </span>
                          <p className="text-slate-300 italic leading-relaxed">
                            &ldquo;{item.lawyerQuestion}&rdquo;
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dedicated Lawyer Inquiries Digest Section */}
      {!isLoading && lawyerItems.length > 0 && (
        <div className="mt-8 pt-6 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base select-none">⚖️</span>
                <h3 className="text-base font-bold text-amber-300">{langLabels.lawyerSectionTitle}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{langLabels.lawyerSectionSub}</p>
            </div>
            <button
              onClick={handleCopyLawyerQuestions}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-colors self-start sm:self-auto"
            >
              {copiedSection === 'lawyer' ? langLabels.copied : langLabels.copyLawyer}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lawyerItems.map((item, idx) => (
              <div
                key={`lawyer-summary-${item.id}`}
                className="p-3.5 rounded-xl bg-slate-950/70 border border-amber-500/20 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-200">
                    #{idx + 1}. {item.clauseHeading || 'Clause'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.severity === 'high' ? 'text-rose-400' : 'text-amber-400'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-amber-100/90 italic leading-relaxed">
                  &ldquo;{item.lawyerQuestion}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
