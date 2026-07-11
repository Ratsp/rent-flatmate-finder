import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Field, Spinner } from '../components/ui';
import { AuthShell } from './Login';
import { homeFor } from '../routes';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'tenant' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="Find a room or list one in minutes">
      <form onSubmit={submit} className="space-y-4">
        <Field label="I am a">
          <div className="grid grid-cols-2 gap-2">
            {['tenant', 'owner'].map((r) => (
              <button type="button" key={r} onClick={() => setForm({ ...form, role: r })}
                className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  form.role === r ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}>
                {r === 'tenant' ? 'Tenant (looking)' : 'Owner (listing)'}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Full name">
          <input className="input" required minLength={2} value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <input className="input" type="email" required value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
        </Field>
        <Field label="Password">
          <input className="input" type="password" required minLength={6} value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 6 characters" />
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
      </p>
    </AuthShell>
  );
}
