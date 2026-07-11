import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Field, Spinner, PageLoader } from '../../components/ui';

const ROOM_TYPES = ['single', 'shared', '1BHK', '2BHK', '3BHK', 'studio'];
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

export default function Profile() {
  const toast = useToast();
  const [form, setForm] = useState({ preferred_location: '', budget_min: '', budget_max: '', room_type_pref: '', move_in_date: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProfile()
      .then((res) => {
        const p = res.profile;
        setForm({
          preferred_location: p.preferred_location || '',
          budget_min: p.budget_min || '',
          budget_max: p.budget_max || '',
          room_type_pref: p.room_type_pref || '',
          move_in_date: toDateInput(p.move_in_date),
        });
      })
      .catch(() => { /* no profile yet — keep blank form */ })
      .finally(() => setLoading(false));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.saveProfile({
        preferred_location: form.preferred_location,
        budget_min: Number(form.budget_min),
        budget_max: Number(form.budget_max),
        room_type_pref: form.room_type_pref || null,
        move_in_date: form.move_in_date || null,
      });
      toast.success('Profile saved — scores will refresh on your next browse.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Your preferences</h1>
      <p className="mb-5 text-sm text-slate-500">We use these to compute your compatibility with each listing.</p>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <Field label="Preferred location">
          <input className="input" required value={form.preferred_location}
            onChange={(e) => setForm({ ...form, preferred_location: e.target.value })} placeholder="e.g. Koramangala, Bangalore" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Budget min (₹)">
            <input className="input" type="number" min="0" required value={form.budget_min}
              onChange={(e) => setForm({ ...form, budget_min: e.target.value })} />
          </Field>
          <Field label="Budget max (₹)">
            <input className="input" type="number" min="0" required value={form.budget_max}
              onChange={(e) => setForm({ ...form, budget_max: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Preferred room type">
            <select className="input" value={form.room_type_pref}
              onChange={(e) => setForm({ ...form, room_type_pref: e.target.value })}>
              <option value="">No preference</option>
              {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Move-in date">
            <input className="input" type="date" value={form.move_in_date}
              onChange={(e) => setForm({ ...form, move_in_date: e.target.value })} />
          </Field>
        </div>
        <button className="btn-primary w-full" disabled={saving}>
          {saving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Save preferences'}
        </button>
      </form>
    </div>
  );
}
