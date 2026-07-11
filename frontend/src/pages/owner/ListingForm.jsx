import { useState } from 'react';
import { api } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Field, Spinner } from '../../components/ui';

const ROOM_TYPES = ['single', 'shared', '1BHK', '2BHK', '3BHK', 'studio'];
const FURNISHING = ['furnished', 'semi-furnished', 'unfurnished'];
const toDateInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

// Create/edit form. Pass `listing` to edit; omit to create. Calls onSaved() on success.
export default function ListingForm({ listing, onSaved }) {
  const toast = useToast();
  const isEdit = Boolean(listing);
  const [form, setForm] = useState({
    location: listing?.location || '',
    rent: listing?.rent || '',
    available_from: toDateInput(listing?.available_from),
    room_type: listing?.room_type || 'single',
    furnishing_status: listing?.furnishing_status || 'furnished',
    description: listing?.description || '',
    photos: listing?.photos || [],
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const uploadPhotos = async (e) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((f) => fd.append('photos', f));
      const res = await api.uploadPhotos(fd);
      setForm((f) => ({ ...f, photos: [...f.photos, ...res.urls] }));
      toast.success('Photos uploaded');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removePhoto = (url) => setForm((f) => ({ ...f, photos: f.photos.filter((p) => p !== url) }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      location: form.location,
      rent: Number(form.rent),
      available_from: form.available_from,
      room_type: form.room_type,
      furnishing_status: form.furnishing_status,
      description: form.description,
      photos: form.photos,
    };
    try {
      if (isEdit) await api.updateListing(listing.id, payload);
      else await api.createListing(payload);
      toast.success(isEdit ? 'Listing updated' : 'Listing created');
      onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Location">
        <input className="input" required value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Koramangala, Bangalore" />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Rent (₹/month)">
          <input className="input" type="number" min="0" required value={form.rent}
            onChange={(e) => setForm({ ...form, rent: e.target.value })} />
        </Field>
        <Field label="Available from">
          <input className="input" type="date" required value={form.available_from}
            onChange={(e) => setForm({ ...form, available_from: e.target.value })} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Room type">
          <select className="input" value={form.room_type}
            onChange={(e) => setForm({ ...form, room_type: e.target.value })}>
            {ROOM_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </Field>
        <Field label="Furnishing">
          <select className="input" value={form.furnishing_status}
            onChange={(e) => setForm({ ...form, furnishing_status: e.target.value })}>
            {FURNISHING.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Description">
        <textarea className="input min-h-[80px]" value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Highlight what makes this room great…" />
      </Field>

      <Field label="Photos">
        <div className="flex flex-wrap gap-2">
          {form.photos.map((url) => (
            <div key={url} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200">
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => removePhoto(url)}
                className="absolute right-0 top-0 bg-slate-900/60 px-1 text-xs text-white">✕</button>
            </div>
          ))}
          <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-400 hover:bg-slate-50">
            {uploading ? <Spinner className="h-4 w-4" /> : '＋'}
            <input type="file" accept="image/*" multiple className="hidden" onChange={uploadPhotos} disabled={uploading} />
          </label>
        </div>
      </Field>

      <button className="btn-primary w-full" disabled={saving || uploading}>
        {saving ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : isEdit ? 'Save changes' : 'Create listing'}
      </button>
    </form>
  );
}
