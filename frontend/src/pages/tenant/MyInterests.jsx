import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PageLoader, EmptyState, Badge, ScoreBadge } from '../../components/ui';
import { money, fmtDate } from '../../components/ListingCard';

export default function MyInterests() {
  const toast = useToast();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myInterests()
      .then((res) => setInterests(res.interests))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <PageLoader />;

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">My interests</h1>
      <p className="mb-5 text-sm text-slate-500">Track the rooms you've expressed interest in.</p>

      {interests.length === 0 ? (
        <EmptyState title="No interests yet" subtitle="Browse listings and send interest to get started." />
      ) : (
        <div className="space-y-3">
          {interests.map((i) => (
            <div key={i.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">{i.location}</h3>
                  <Badge status={i.status} />
                </div>
                <p className="mt-0.5 text-sm text-slate-500">
                  {money(i.rent)}/mo · <span className="capitalize">{i.room_type}</span> · by {i.owner_name}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">Sent {fmtDate(i.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <ScoreBadge score={i.compatibility_score} />
                {i.status === 'accepted' && (
                  <Link to={`/chat/${i.id}`} className="btn-primary">Open chat</Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
