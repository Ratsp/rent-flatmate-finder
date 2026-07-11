import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LINKS = {
  tenant: [
    { to: '/browse', label: 'Browse' },
    { to: '/interests', label: 'My Interests' },
    { to: '/chat', label: 'Chat' },
    { to: '/profile', label: 'Profile' },
  ],
  owner: [
    { to: '/listings', label: 'My Listings' },
    { to: '/chat', label: 'Chat' },
  ],
  admin: [
    { to: '/admin', label: 'Dashboard' },
  ],
};

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const links = LINKS[user?.role] || [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">⌂</span>
          <span className="hidden sm:inline">Rent&nbsp;&amp;&nbsp;Flatmate&nbsp;Finder</span>
        </div>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass}>{l.label}</NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-800">{user?.name}</p>
            <p className="text-xs capitalize text-slate-400">{user?.role}</p>
          </div>
          <button onClick={handleLogout} className="btn-secondary">Logout</button>
          {links.length > 0 && (
            <button
              className="md:hidden rounded-lg border border-slate-300 px-2 py-1.5 text-slate-600"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >☰</button>
          )}
        </div>
      </div>

      {open && (
        <nav className="flex flex-col gap-1 border-t border-slate-100 px-4 py-2 md:hidden">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className={linkClass} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
}
