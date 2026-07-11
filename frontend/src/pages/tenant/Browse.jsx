import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ListingCard from '../../components/ListingCard';
import { PageLoader, EmptyState, Badge } from '../../components/ui';

const ROOM_TYPES = ['single', 'shared', '1BHK', '2BHK', '3BHK', 'studio'];
const empty = { location: '', budget_min: '', budget_max: '', room_type: '' };

export default function Browse() {
  const toast = useToast();
  const [filters, setFilters] = useState(empty);
  const [listings, setListings] = useState([]);
  const [interestMap, setInterestMap] = useState({}); // listing_id -> status
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [hasProfile, setHasProfile] = useState(true);

  const load = useCallback(async (f = filters) => {
    setLoading(true);
    try {
      const [browse, mine] = await Promise.all([api.browseListings(f), api.myInterests()]);
      setListings(browse.listings);
      const map = {};
      mine.interests.forEach((i) => { map[i.listing_id] = i.status; });
      setInterestMap(map);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  // Detect whether the tenant has a profile (scores need it)
  useEffect(() => {
    api.getProfile().then(() => setHasProfile(true)).catch(() => setHasProfile(false));
    load(empty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = (e) => { e.preventDefault(); load(filters); };
  const reset = () => { setFilters(empty); load(empty); };

  const sendInterest = async (listing) => {
    setSending(listing.id);
    try {
      const res = await api.sendInterest(listing.id);
      setInterestMap((m) => ({ ...m, [listing.id]: 'pending' }));
      toast.success(`Interest sent · score ${res.compatibility_score.score}/100`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900">Browse rooms</h1>
        <p className="text-sm text-slate-500">Listings ranked by your AI compatibility score.</p>
      </div>

      {!hasProfile && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Create your <Link to="/profile" className="font-semibold underline">tenant profile</Link> to unlock compatibility scores.
        </div>
      )}

      <form onSubmit={applyFilters} className="card mb-6 grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <input className="input" placeholder="Location" value={filters.location}
          onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
        <input className="input" type="number" min="0" placeholder="Min budget" value={filters.budget_min}
          onChange={(e) => setFilters({ ...filters, budget_min: e.target.value })} />
        <input className="input" type="number" min="0" placeholder="Max budget" value={filters.budget_max}
          onChange={(e) => setFilters({ ...filters, budget_max: e.target.value })} />
        <select className="input" value={filters.room_type}
          onChange={(e) => setFilters({ ...filters, room_type: e.target.value })}>
          <option value="">Any room type</option>
          {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-2">
          <button className="btn-primary flex-1">Apply</button>
          <button type="button" onClick={reset} className="btn-secondary">Reset</button>
        </div>
      </form>

      {loading ? (
        <PageLoader />
      ) : listings.length === 0 ? (
        <EmptyState title="No listings found" subtitle="Try adjusting your filters." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => {
            const status = interestMap[l.id];
            return (
              <ListingCard key={l.id} listing={l} showScore footer={
                status ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Interest</span>
                    <Badge status={status} />
                  </div>
                ) : (
                  <button className="btn-primary w-full" disabled={sending === l.id}
                    onClick={() => sendInterest(l)}>
                    {sending === l.id ? 'Sending…' : 'Send interest'}
                  </button>
                )
              } />
            );
          })}
        </div>
      )}
    </div>
  );
}
