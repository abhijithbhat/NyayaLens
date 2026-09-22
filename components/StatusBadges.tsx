import { VerificationStatus, RiskSeverity } from '@/lib/types';

export function VerificationBadge({
  status,
  label,
  details,
}: {
  status: VerificationStatus;
  label?: string;
  details?: string;
}) {
  const isVerified = status === 'verified';
  return (
    <span
      title={details}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border transition-all ${
        isVerified
          ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-bright)] border-[var(--accent-primary)]/40 shadow-sm'
          : 'bg-[#EAB308]/10 text-[#FDE047] border-[#EAB308]/40'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isVerified ? 'bg-[var(--accent-bright)] shadow-[0_0_6px_var(--accent-bright)]' : 'bg-[#EAB308]'
        }`}
      />
      {label || (isVerified ? 'Dual-Gate Verified' : 'Needs Review • Unverified')}
    </span>
  );
}

export function RiskBadge({ severity }: { severity: RiskSeverity }) {
  if (severity === 'unknown') {
    return (
      <span
        title="Risk severity could not be verified against the source clause text."
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-medium border border-dashed border-[var(--text-muted)]/60 bg-[var(--bg-surface-raised)]/60 text-[var(--text-muted)] shadow-inner"
      >
        <span className="text-[11px] opacity-75">?</span>
        <span>Severity Not Confirmed</span>
      </span>
    );
  }

  const styles: Record<Exclude<RiskSeverity, 'unknown'>, string> = {
    high: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
    medium: 'bg-[#EAB308]/15 text-[#FDE047] border-[#EAB308]/40', // Clear gold, distinct from burnt-orange
    low: 'bg-sky-500/15 text-sky-300 border-sky-500/40',         // Cool blue for contrast against warm palette
    none: 'bg-[var(--bg-surface-raised)] text-[var(--text-muted)] border-[var(--text-muted)]/30',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-sm ${
        styles[severity] || styles.none
      }`}
    >
      {severity} Risk
    </span>
  );
}
