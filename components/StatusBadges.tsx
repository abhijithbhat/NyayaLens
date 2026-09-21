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
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
        isVerified
          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
          : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {label || (isVerified ? 'Dual-Gate Verified' : 'Needs Review • Unverified')}
    </span>
  );
}

export function RiskBadge({ severity }: { severity: RiskSeverity }) {
  const styles: Record<RiskSeverity, string> = {
    high: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    low: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    none: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
        styles[severity] || styles.none
      }`}
    >
      {severity} Risk
    </span>
  );
}
