import { ScoreBadge, Badge, TrustBadge } from './ui';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

// Presentational listing card. `footer` renders custom actions below the details.
export default function ListingCard({ listing, showScore = false, showStatus = false, footer }) {
  const photo = listing.photos?.[0];
  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="h-36 w-full bg-slate-100">
        {photo ? (
          <img src={photo} alt={listing.location} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-slate-300">⌂</div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-tight text-slate-900">{listing.location}</h3>
          {showStatus && <Badge status={listing.status} />}
        </div>

        <p className="mt-1 text-lg font-bold text-brand-700">{money(listing.rent)}<span className="text-xs font-normal text-slate-400">/mo</span></p>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 capitalize text-slate-600">{listing.room_type}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 capitalize text-slate-600">{listing.furnishing_status}</span>
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600">From {fmtDate(listing.available_from)}</span>
        </div>

        {listing.description && (
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{listing.description}</p>
        )}

        {listing.owner_name && (
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-xs text-slate-400">Listed by {listing.owner_name}</p>
            <TrustBadge rate={listing.response_rate} hours={listing.avg_response_hours} count={listing.owner_total_interests} />
          </div>
        )}

        {showScore && (
          <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">Compatibility</span>
              <ScoreBadge score={listing.compatibility_score} />
            </div>
            {listing.score_explanation && (
              <p className="mt-1.5 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Why you match: </span>
                {listing.score_explanation}
              </p>
            )}
          </div>
        )}

        {footer && <div className="mt-4">{footer}</div>}
      </div>
    </div>
  );
}

export { money, fmtDate };
