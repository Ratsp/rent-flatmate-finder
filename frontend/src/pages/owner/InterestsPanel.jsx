import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PageLoader, EmptyState, Badge, ScoreBadge } from '../../components/ui';
import { money } from '../../components/ListingCard';

// Shows interested tenants for one listing, ranked by score. Owner accepts/declines.
export default function InterestsPanel({ listingId }) {
  const toast = useToast();
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(null);

  const load = () => {
    setLoading(true);
    api.listingInterests(listingId)
      .then((res) => setInterests(res.interests))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const respond = async (id, status) => {
    setActing(id + status);
    try {
      await api.respondInterest(id, status);
      toast.success(`Interest ${status}`);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setActing(null);
    }
  };

  if (loading) return <PageLoader />;
  if (interests.length === 0) return <EmptyState title="No interests yet" subtitle="Interested tenants will appear here, ranked by compatibility." />;

  return (
    <div className="space-y-3">
      {interests.map((i) => (
        <div key={i.id} className="rounded-lg border border-slate-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-medium text-slate-900">{i.tenant_name}</p>
              <p className="text-xs text-slate-500">{i.tenant_email}</p>
            </div>
            <ScoreBadge score={i.compatibility_score} />
          </div>

          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {i.preferred_location && <span>Wants: {i.preferred_location}</span>}
            {i.budget_min && <span>Budget: {money(i.budget_min)}–{money(i.budget_max)}</span>}
            {i.room_type_pref && <span className="capitalize">Prefers: {i.room_type_pref}</span>}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Badge status={i.status} />
            {i.status === 'pending' ? (
              <div className="flex gap-2">
                <button className="btn-success !px-3 !py-1.5" disabled={acting === i.id + 'accepted'}
                  onClick={() => respond(i.id, 'accepted')}>Accept</button>
                <button className="btn-secondary !px-3 !py-1.5" disabled={acting === i.id + 'declined'}
                  onClick={() => respond(i.id, 'declined')}>Decline</button>
              </div>
            ) : i.status === 'accepted' ? (
              <Link to={`/chat/${i.id}`} className="btn-primary !px-3 !py-1.5">Open chat</Link>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
