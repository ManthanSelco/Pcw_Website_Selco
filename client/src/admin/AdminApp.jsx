import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import Dashboard from './Dashboard.jsx';
import Events from './Events.jsx';
import Rsvps from './Rsvps.jsx';
import Newsletter from './Newsletter.jsx';
import Bookings from './Bookings.jsx';
import Settings from './Settings.jsx';
import Spaces from './Spaces.jsx';
import Recordings from './Recordings.jsx';
import Faq from './Faq.jsx';
import './admin.css';

// ---- tiny router for /admin/... ----
const Ctx = createContext(null);
export const useAdmin = () => useContext(Ctx);

function usePath() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const on = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const go = useCallback((to) => {
    window.history.pushState({}, '', to);
    setPath(to);
    window.scrollTo(0, 0);
  }, []);
  return [path, go];
}

export function Link({ to, className, children, ...rest }) {
  const { go } = useAdmin();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        go(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}

// Two-click delete button (no browser pop-ups)
export function ConfirmButton({ onConfirm, children = 'Delete', confirmText = 'Click again to confirm', className = 'adm-btn adm-btn-danger' }) {
  const [ask, setAsk] = useState(false);
  useEffect(() => {
    if (!ask) return;
    const t = setTimeout(() => setAsk(false), 4000);
    return () => clearTimeout(t);
  }, [ask]);
  return (
    <button type="button" className={className + (ask ? ' is-confirm' : '')} onClick={() => (ask ? (setAsk(false), onConfirm()) : setAsk(true))}>
      {ask ? confirmText : children}
    </button>
  );
}

function Login({ onDone }) {
  const [u, setU] = useState('admin');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api('/api/admin/login', { username: u, password: p });
      onDone();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm-login">
      <form className="adm-login-card" onSubmit={submit}>
        <span className="adm-logo">PCW</span>
        <h1>Admin login</h1>
        <label>
          Login ID
          <input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required autoFocus />
        </label>
        {err && (
          <p className="adm-error" role="alert">
            {err}
          </p>
        )}
        <button className="adm-btn adm-btn-primary adm-btn-block" disabled={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </button>
        <a href="/" className="adm-muted-link">
          ← Back to website
        </a>
      </form>
    </div>
  );
}

const MENU = [
  ['/admin', 'Dashboard'],
  ['/admin/events', 'Events'],
  ['/admin/recordings', 'Recordings'],
  ['/admin/spaces', 'City spaces'],
  ['/admin/rsvps', 'RSVPs'],
  ['/admin/newsletter', 'Newsletter'],
  ['/admin/faq', 'FAQ'],
  ['/admin/settings', 'Settings'],
];

export default function AdminApp() {
  const [me, setMe] = useState(undefined);
  const [path, go] = usePath();
  const [toast, setToast] = useState(null);
  const [menu, setMenu] = useState(false);

  const check = useCallback(() => api('/api/admin/me').then(setMe).catch(() => setMe(null)), []);
  useEffect(() => {
    document.title = 'PCW Admin';
    document.body.classList.remove('nooverflow');
    document.body.classList.add('adm-body');
    check();
  }, [check]);
  useEffect(() => setMenu(false), [path]);

  const notify = useCallback((msg, type = 'ok') => {
    const id = Date.now();
    setToast({ msg, type, id });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3000);
  }, []);

  // any 401 while working -> back to login
  const call = useCallback(
    async (...args) => {
      try {
        return await api(...args);
      } catch (e) {
        if (e.status === 401) setMe(null);
        throw e;
      }
    },
    []
  );

  if (me === undefined) return <div className="adm-loading" />;
  if (!me) return <Login onDone={check} />;

  const pathname = path.split('?')[0].replace(/\/+$/, '') || '/admin';
  const page =
    pathname.startsWith('/admin/events') ? <Events /> :
    pathname === '/admin/spaces' ? <Spaces /> :
    pathname === '/admin/recordings' ? <Recordings /> :
    pathname === '/admin/rsvps' ? <Rsvps /> :
    pathname === '/admin/newsletter' ? <Newsletter /> :
    pathname === '/admin/bookings' ? <Bookings /> :
    pathname === '/admin/faq' ? <Faq /> :
    pathname === '/admin/settings' ? <Settings /> :
    <Dashboard />;

  async function logout() {
    await api('/api/admin/logout', {});
    setMe(null);
  }

  return (
    <Ctx.Provider value={{ go, path, notify, call, me }}>
      <div className="adm-shell">
        <aside className={`adm-side ${menu ? 'is-open' : ''}`}>
          <div className="adm-brand">
            <span className="adm-logo">PCW</span>
            <span>Admin</span>
          </div>
          <nav aria-label="Admin">
            {MENU.map(([to, label]) => (
              <Link key={to} to={to} className={`adm-nav ${(to === '/admin' ? pathname === '/admin' : pathname.startsWith(to)) ? 'is-on' : ''}`}>
                {label}
              </Link>
            ))}
          </nav>
          <div className="adm-side-foot">
            <a className="adm-nav" href="/" target="_blank" rel="noreferrer">
              View website ↗
            </a>
            <button className="adm-nav" onClick={logout}>
              Log out ({me.username})
            </button>
          </div>
        </aside>
        <div className="adm-main">
          <header className="adm-top">
            <button className="adm-burger" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>
              <span />
              <span />
              <span />
            </button>
            <span className="adm-logo">PCW</span>
            <span>Admin</span>
            {me.db === 'json' && <span className="adm-pill adm-pill-warn">Test database</span>}
          </header>
          {me.db === 'json' && <p className="adm-dbnote">Test mode: data is saved in a local file (data/db.json). Set MONGODB_URI in server/.env to use MongoDB.</p>}
          <main className="adm-content">{page}</main>
        </div>
        {menu && <div className="adm-scrim" onClick={() => setMenu(false)} />}
        {toast && (
          <div className={`adm-toast adm-toast-${toast.type}`} role="status">
            {toast.msg}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}
