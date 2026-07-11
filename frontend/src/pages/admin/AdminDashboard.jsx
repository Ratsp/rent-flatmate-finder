import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { PageLoader, EmptyState, Badge, ScoreBadge } from '../../components/ui';
import { money, fmtDate } from '../../components/ListingCard';

const TABS = ['Overview', 'Users', 'Listings', 'Interests'];

export default function AdminDashboard() {
  const [tab, setTab] = useState('Overview');
  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Admin dashboard</h1>
      <p className="mb-5 text-sm text-slate-500">Platform activity and management.</p>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-2 text-sm font-medium transition-colors ${
              tab === t ? 'border-b-2 border-brand-600 text-brand-700' : 'text-slate-500 hover:text-slate-700'
            }`}>{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <Overview />}
      {tab === 'Users' && <Users />}
      {tab === 'Listings' && <Listings />}
      {tab === 'Interests' && <Interests />}
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function Overview() {
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.adminStats().then(setData).catch((e) => toast.error(e.message));
  }, [toast]);

  if (!data) return <PageLoader />;
  const { stats, recent } = data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Users" value={stats.users.total}
          hint={`${stats.users.tenant || 0} tenants · ${stats.users.owner || 0} owners`} />
        <StatCard label="Listings" value={stats.listings.total}
          hint={`${stats.listings.active || 0} active · ${stats.listings.filled || 0} filled`} />
        <StatCard label="Interests" value={stats.interest_requests} />
        <StatCard label="Matches" value={stats.accepted_matches} hint="accepted" />
        <StatCard label="Avg score" value={`${stats.avg_compatibility_score}`} hint="/ 100" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Recent signups</h3>
          <ul className="divide-y divide-slate-100">
            {recent.users.map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium text-slate-800">{u.name}</span> <span className="text-slate-400">· {u.email}</span></span>
                <Badge>{u.role}</Badge>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h3 className="mb-3 font-semibold text-slate-900">Recent listings</h3>
          <ul className="divide-y divide-slate-100">
            {recent.listings.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium text-slate-800">{l.location}</span> <span className="text-slate-400">· {money(l.rent)}</span></span>
                <Badge status={l.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Users() {
  const toast = useToast();
  const [users, setUsers] = useState(null);
  const [search, setSearch] = useState('');

  const load = (s = search) => api.adminUsers({ search: s }).then((r) => setUsers(r.users)).catch((e) => toast.error(e.message));
  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = async (u) => {
    try { await api.adminToggleUser(u.id, !u.is_active); toast.success(`User ${!u.is_active ? 'activated' : 'deactivated'}`); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (!users) return <PageLoader />;

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); load(); }} className="mb-4 flex gap-2">
        <input className="input max-w-xs" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn-secondary">Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
            <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-slate-500">{u.email}</td>
                <td className="px-4 py-3"><Badge>{u.role}</Badge></td>
                <td className="px-4 py-3">
                  <span className={u.is_active ? 'text-emerald-600' : 'text-rose-600'}>{u.is_active ? 'Active' : 'Disabled'}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {u.role !== 'admin' && (
                    <button onClick={() => toggle(u)} className={u.is_active ? 'btn-secondary !py-1' : 'btn-success !py-1'}>
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Listings() {
  const toast = useToast();
  const [listings, setListings] = useState(null);

  const load = () => api.adminListings().then((r) => setListings(r.listings)).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (l) => {
    if (!window.confirm(`Force-delete listing in ${l.location}?`)) return;
    try { await api.adminDeleteListing(l.id); toast.success('Listing deleted'); load(); }
    catch (e) { toast.error(e.message); }
  };

  if (!listings) return <PageLoader />;
  if (listings.length === 0) return <EmptyState title="No listings" />;

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
          <tr><th className="px-4 py-3">Location</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Rent</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Interests</th><th className="px-4 py-3 text-right">Action</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {listings.map((l) => (
            <tr key={l.id}>
              <td className="px-4 py-3 font-medium text-slate-800">{l.location}</td>
              <td className="px-4 py-3 text-slate-500">{l.owner_name}</td>
              <td className="px-4 py-3">{money(l.rent)}</td>
              <td className="px-4 py-3"><Badge status={l.status} /></td>
              <td className="px-4 py-3">{l.interest_count}</td>
              <td className="px-4 py-3 text-right"><button onClick={() => remove(l)} className="btn-danger !py-1">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Interests() {
  const toast = useToast();
  const [interests, setInterests] = useState(null);
  const [status, setStatus] = useState('');

  const load = (s = status) => api.adminInterests({ status: s }).then((r) => setInterests(r.interests)).catch((e) => toast.error(e.message));
  useEffect(() => { load(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filter = (s) => { setStatus(s); load(s); };

  if (!interests) return <PageLoader />;

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {['', 'pending', 'accepted', 'declined'].map((s) => (
          <button key={s} onClick={() => filter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${status === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>
            {s || 'All'}
          </button>
        ))}
      </div>
      {interests.length === 0 ? <EmptyState title="No interest requests" /> : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
              <tr><th className="px-4 py-3">Tenant</th><th className="px-4 py-3">Listing</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Sent</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interests.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">{i.tenant_name}</td>
                  <td className="px-4 py-3 text-slate-500">{i.location}</td>
                  <td className="px-4 py-3 text-slate-500">{i.owner_name}</td>
                  <td className="px-4 py-3"><ScoreBadge score={i.compatibility_score} /></td>
                  <td className="px-4 py-3"><Badge status={i.status} /></td>
                  <td className="px-4 py-3 text-slate-400">{fmtDate(i.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
