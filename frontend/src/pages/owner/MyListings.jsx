import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ListingCard from '../../components/ListingCard';
import Modal from '../../components/Modal';
import { PageLoader, EmptyState } from '../../components/ui';
import ListingForm from './ListingForm';
import InterestsPanel from './InterestsPanel';

export default function MyListings() {
  const toast = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(undefined); // undefined=closed, null=new, obj=edit
  const [viewing, setViewing] = useState(null); // listing whose interests are shown

  const load = () => {
    setLoading(true);
    api.myListings()
      .then((res) => setListings(res.listings))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onSaved = () => { setEditing(undefined); load(); };

  const remove = async (l) => {
    if (!window.confirm(`Delete listing in ${l.location}? This cannot be undone.`)) return;
    try { await api.deleteListing(l.id); toast.success('Listing deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const fill = async (l) => {
    try { await api.fillListing(l.id); toast.success('Marked as filled'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My listings</h1>
          <p className="text-sm text-slate-500">Post rooms and manage interested tenants.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing(null)}>＋ New listing</button>
      </div>

      {loading ? (
        <PageLoader />
      ) : listings.length === 0 ? (
        <EmptyState title="No listings yet" subtitle="Create your first room listing to start receiving interest." />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} showStatus footer={
              <div className="space-y-2">
                <button className="btn-secondary w-full" onClick={() => setViewing(l)}>
                  Interests · {l.interest_count}{Number(l.accepted_count) > 0 ? ` (${l.accepted_count} accepted)` : ''}
                </button>
                <div className="grid grid-cols-3 gap-2">
                  <button className="btn-secondary !px-2" onClick={() => setEditing(l)}>Edit</button>
                  <button className="btn-secondary !px-2 disabled:opacity-40" disabled={l.status === 'filled'} onClick={() => fill(l)}>Fill</button>
                  <button className="btn-danger !px-2" onClick={() => remove(l)}>Delete</button>
                </div>
              </div>
            } />
          ))}
        </div>
      )}

      <Modal open={editing !== undefined} onClose={() => setEditing(undefined)}
        title={editing ? 'Edit listing' : 'New listing'}>
        <ListingForm listing={editing || undefined} onSaved={onSaved} />
      </Modal>

      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)}
        title={viewing ? `Interests · ${viewing.location}` : ''}>
        {viewing && <InterestsPanel listingId={viewing.id} />}
      </Modal>
    </div>
  );
}
