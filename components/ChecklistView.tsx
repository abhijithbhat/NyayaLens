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
      lawyerSectionTitle: 'Questions to Raise with Your Legal Advocate',
      lawyerSectionSub: 'Starting points to explore with an advocate — statutory references are discussion topics to verify in context, not settled legal advice.',
      emptyTitle: 'No High or Medium Risk Items Found',
      emptySub: 'All analyzed terms appear standard, or all items have passed verification with low risk.',
      copyLawyer: 'Copy Advocate Questions',
      copyAll: 'Copy Entire Checklist',
      copied: 'Copied!',
    },
    hi: {
      badge: 'कार्य सूची (चेकलिस्ट)',
      lawyerSectionTitle: 'अपने कानूनी सलाहकार (वकील) से चर्चा के बिंदु',
      lawyerSectionSub: 'वकील से परामर्श के लिए शुरुआती बिंदु — कानूनी धाराओं को परामर्श विषय के रूप में उठाएं, न कि अंतिम निष्कर्ष के रूप में।',
      emptyTitle: 'कोई उच्च या मध्यम जोखिम वाले खंड नहीं मिले',
      emptySub: 'सभी विश्लेषित शर्तें सामान्य पाई गई हैं।',
      copyLawyer: 'वकील के प्रश्न कॉपी करें',
      copyAll: 'पूरी सूची कॉपी करें',
      copied: 'कॉपी हो गया!',
    },
    kn: {
      badge: 'ಕ್ರಿಯಾ ಪರಿಶೀಲನಾ ಪಟ್ಟಿ',
      lawyerSectionTitle: 'ನಿಮ್ಮ ವಕೀಲರೊಂದಿಗೆ ಚರ್ಚಿಸಬೇಕಾದ ಆರಂಭಿಕ ಅಂಶಗಳು',
      lawyerSectionSub: 'ವಕೀಲರೊಂದಿಗೆ ಸಮಾಲೋಚನೆಗೆ ಆರಂಭಿಕ ಮಾರ್ಗದರ್ಶಿ — ಶಾಸನಬದ್ಧ ಪ್ರಶ್ನೆಗಳನ್ನು ಚರ್ಚೆಯ ವಿಷಯವಾಗಿ ಪರಿಗಣಿಸಿ.',
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
          `${idx + 1}. [${item.clauseHeading || 'Clause'}] (Risk: ${item.severity.toUpperCase()})\nQuestion for Advocate: ${item.lawyerQuestion}`
      )
      .join('\n\n');
    copyToClipboard(text, 'lawyer');
  }

  function handleCopyAllChecklist() {
    const text = items
      .map((item, idx) => {
        let block = `${idx + 1}. [${item.clauseHeading || 'Clause'}] [${item.completed ? 'COMPLETED' : 'PENDING'}]\nAction: ${item.checklistAction}`;
        if (item.lawyerQuestion) {
          block += `\nAdvocate Question: ${item.lawyerQuestion}`;
        }
        return block;
      })
      .join('\n\n');
    copyToClipboard(text, 'all');
  }

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--bg-surface-raised)] rounded-2xl p-6 shadow-xl space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--bg-surface-raised)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-semibold px-2.5 py-0.5 rounded bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)]">
              {langLabels.badge}
            </span>
            <span className="text-xs text-[var(--text-muted)] font-mono">
              {items.length} {items.length === 1 ? 'Action Item' : 'Action Items'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-[var(--text-primary)] mt-1.5 font-display">{title}</h2>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        </div>

        {/* Progress & Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {totalCount > 0 && (
            <div className="flex items-center gap-2 bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] px-3 py-1.5 rounded-xl">
              <div className="w-16 bg-[var(--bg-surface-raised)] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-[var(--accent-bright)] h-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-mono font-medium text-[var(--text-primary)]">
                {completedCount}/{totalCount} ({progressPct}%)
              </span>
            </div>
          )}

          {onRegenerate && (
            <button
              onClick={onRegenerate}
              disabled={isLoading}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--bg-surface-raised)] bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? 'Regenerating...' : 'Regenerate'}
            </button>
          )}

          {totalCount > 0 && (
            <button
              onClick={handleCopyAllChecklist}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[var(--bg-surface-raised)] bg-[var(--bg-surface-raised)] hover:bg-[var(--bg-surface)] text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {copiedSection === 'all' ? langLabels.copied : langLabels.copyAll}
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs if items exist */}
      {totalCount > 0 && (
        <div className="flex items-center justify-between gap-3 text-xs border-b border-[var(--bg-surface-raised)] pb-3">
          <div className="flex items-center gap-1.5 bg-[var(--bg-base)] p-1 rounded-lg border border-[var(--bg-surface-raised)]">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-[var(--accent-primary)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'pending' ? 'bg-[var(--accent-primary)] text-white shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Pending ({totalCount - completedCount})
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'completed' ? 'bg-[var(--accent-bright)] text-black font-semibold shadow' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
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
          <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--text-primary)] font-medium">Generating checklist &amp; advocate questions...</p>
          <p className="text-xs text-[var(--text-muted)]">Synthesizing verified terms and drafting advocate inquiries</p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && items.length === 0 && (
        <div className="py-10 px-6 rounded-xl bg-[var(--bg-base)] border border-[var(--bg-surface-raised)] text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/30 text-[var(--accent-bright)] mx-auto flex items-center justify-center font-bold text-lg">
            ✓
          </div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">{langLabels.emptyTitle}</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">{langLabels.emptySub}</p>
        </div>
      )}

      {/* Checklist Items List */}
      {!isLoading && displayedItems.length > 0 && (
        <div className="space-y-3.5">
          {displayedItems.map((item) => {
            const isHigh = item.severity === 'high';
            const isReview = item.verificationStatus === 'needs_review';
            const hasStatuteRef = Boolean(
              item.lawyerQuestion &&
              /(?:section\s+\d+|act\b|statute|code|rera|transfer of property|contract act)/i.test(item.lawyerQuestion)
            );

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  item.completed
                    ? 'bg-[var(--bg-base)]/40 border-[var(--bg-surface-raised)]/50 opacity-60'
                    : isHigh
                    ? 'bg-rose-950/10 border-rose-500/30 hover:border-rose-500/50'
                    : isReview
                    ? 'bg-[#EAB308]/5 border-[#EAB308]/30 hover:border-[#EAB308]/50'
                    : 'bg-[var(--bg-base)]/70 border-[var(--bg-surface-raised)] hover:border-[var(--text-muted)]/40'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  {/* Interactive Checkbox */}
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!item.completed}
                    onClick={() => onToggleItem && onToggleItem(item.id)}
                    className={`mt-0.5 w-5 h-5 rounded flex items-center justify-center border transition-all cursor-pointer ${
                      item.completed
                        ? 'bg-[var(--accent-bright)] border-[var(--accent-bright)] text-black font-bold'
                        : 'border-[var(--text-muted)]/50 bg-[var(--bg-surface)] hover:border-[var(--accent-primary)]'
                    }`}
                    aria-label={`Mark ${item.clauseHeading || 'clause'} as ${item.completed ? 'pending' : 'completed'}`}
                  >
                    {item.completed && <span className="text-xs font-bold leading-none" aria-hidden="true">✓</span>}
                  </button>

                  <div className="flex-1 space-y-2">
                    {/* Header line: Title & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold ${
                            item.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                          }`}
                        >
                          {item.clauseHeading || 'Clause'}
                        </span>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">ID: {item.clauseId}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Severity Badge */}
                        {item.severity === 'unknown' ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded border border-dashed border-[var(--text-muted)]/60 bg-[var(--bg-surface-raised)] text-[var(--text-muted)]">
                            UNCONFIRMED RISK
                          </span>
                        ) : (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              item.severity === 'high'
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                                : item.severity === 'medium'
                                ? 'bg-[#EAB308]/15 text-[#FDE047] border-[#EAB308]/40'
                                : 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                            }`}
                          >
                            {item.severity.toUpperCase()} RISK
                          </span>
                        )}

                        {/* Verification Badge */}
                        {item.verificationStatus === 'verified' ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-primary)]/10 text-[var(--accent-bright)] border border-[var(--accent-primary)]/30">
                            Dual-Gate Verified
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EAB308]/10 text-[#FDE047] border border-[#EAB308]/30">
                            Needs Review
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pre-signing Action */}
                    <p
                      className={`text-sm leading-relaxed ${
                        item.completed ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'
                      }`}
                    >
                      <strong className="text-[var(--accent-warm)] font-semibold">Action: </strong>
                      {item.checklistAction}
                    </p>

                    {/* Lawyer Question Callout for High Severity or Needs Review */}
                    {item.lawyerQuestion && item.lawyerQuestion.trim().length > 0 && (
                      <div className="mt-2.5 p-3 rounded-lg bg-[#EAB308]/5 border border-[#EAB308]/25 flex items-start gap-2.5 text-xs text-[#FDE047]">
                        <span className="text-base select-none">⚖️</span>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold text-[#EAB308] uppercase tracking-wider text-[10px]">
                              Starting Point to Raise with Your Advocate:
                            </span>
                            {hasStatuteRef && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#EAB308]/20 text-[#FDE047] border border-[#EAB308]/40 font-medium">
                                Statutory discussion topic • Verify with advocate
                              </span>
                            )}
                          </div>
                          <p className="text-[var(--text-primary)] italic leading-relaxed">
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
        <div className="mt-8 pt-6 border-t border-[var(--bg-surface-raised)] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base select-none">⚖️</span>
                <h3 className="text-base font-bold text-[#FDE047] font-display">{langLabels.lawyerSectionTitle}</h3>
              </div>
              <p className="text-xs text-[var(--text-muted)] mt-0.5">{langLabels.lawyerSectionSub}</p>
            </div>
            <button
              onClick={handleCopyLawyerQuestions}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#EAB308]/40 bg-[#EAB308]/10 hover:bg-[#EAB308]/20 text-[#FDE047] transition-colors self-start sm:self-auto cursor-pointer"
            >
              {copiedSection === 'lawyer' ? langLabels.copied : langLabels.copyLawyer}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {lawyerItems.map((item, idx) => (
              <div
                key={`lawyer-summary-${item.id}`}
                className="p-3.5 rounded-xl bg-[var(--bg-base)] border border-[#EAB308]/25 space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-[var(--text-primary)]">
                    #{idx + 1}. {item.clauseHeading || 'Clause'}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      item.severity === 'high' ? 'text-rose-400' : 'text-[#FDE047]'
                    }`}
                  >
                    {item.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-[var(--text-primary)]/90 italic leading-relaxed">
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
