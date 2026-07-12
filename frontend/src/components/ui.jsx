// Small shared UI primitives.

export function Spinner({ className = '' }) {
  return (
    <div className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 ${className}`} />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

export function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
    </div>
  );
}

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  accepted: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  declined: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  filled: 'bg-slate-100 text-slate-600 ring-slate-500/20',
};

export function Badge({ children, status }) {
  const style = STATUS_STYLES[status] || 'bg-slate-100 text-slate-600 ring-slate-500/20';
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${style}`}>
      {children || status}
    </span>
  );
}

// Compatibility score chip (0-100). Colour reflects match strength.
export function ScoreBadge({ score }) {
  if (score === null || score === undefined) {
    return <span className="text-xs text-slate-400">Not scored</span>;
  }
  const s = Number(score);
  const tone =
    s >= 80 ? 'bg-emerald-100 text-emerald-800'
    : s >= 50 ? 'bg-amber-100 text-amber-800'
    : 'bg-rose-100 text-rose-800';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      <span aria-hidden>◈</span> {s}/100
    </span>
  );
}

// Format avg response hours into a short human label.
const speedLabel = (h) => {
  if (h == null) return null;
  const n = Number(h);
  if (n < 1) return '<1h';
  if (n < 24) return `~${Math.round(n)}h`;
  return `~${Math.round(n / 24)}d`;
};

// Owner trust/responsiveness signal, derived from real interest-response behaviour.
// Tiers: Trusted (≥90% & replies ≤6h) · Responsive (≥70%) · new owners get a neutral chip.
export function TrustBadge({ rate, hours, count }) {
  const n = Number(count) || 0;
  if (n === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
        🆕 New owner
      </span>
    );
  }
  const r = Number(rate);
  const h = hours == null ? null : Number(hours);
  const trusted = r >= 90 && h != null && h <= 6;
  const responsive = r >= 70;
  const tone = trusted
    ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
    : responsive
    ? 'bg-sky-50 text-sky-700 ring-sky-600/20'
    : 'bg-slate-100 text-slate-600 ring-slate-500/20';
  const label = trusted ? '🏅 Trusted owner' : responsive ? '✓ Responsive' : 'Owner';
  const speed = speedLabel(h);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tone}`}
      title={`${r}% response rate${speed ? ` · replies in ${speed}` : ''} · ${n} enquiries`}
    >
      {label}{speed ? ` · ${speed}` : ''}
    </span>
  );
}

export function Field({ label, error, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
