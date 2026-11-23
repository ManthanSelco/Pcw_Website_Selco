import { useEffect, useState } from 'react';
import { useAdmin, Link } from './AdminApp.jsx';
import { formatDate } from '../api.js';

export default function Dashboard() {
  const { call } = useAdmin();
  const [s, setS] = useState(null);
  useEffect(() => {
    call('/api/admin/stats').then(setS).catch(() => {});
  }, [call]);
  if (!s) return <div className="adm-loading" />;

  const tiles = [
    ['Upcoming events', s.upcoming, '/admin/events'],
    ['Past events', s.past, '/admin/events?tab=past'],
    ['Podcasts', s.podcasts, '/admin/recordings?type=podcast'],
    ['Reports', s.reports, '/admin/recordings?type=report'],
    ['Videos', s.videos + s.recordedVideos, '/admin/recordings?type=video'],
    ['RSVPs', s.rsvps, '/admin/rsvps'],
    ['Newsletter', s.newsletter, '/admin/newsletter'],
  ];
  return (
    <>
      <div className="adm-head">
        <h1>Dashboard</h1>
        <Link to="/admin/events?new=1" className="adm-btn adm-btn-primary">
          + Add event
        </Link>
      </div>
      {s.samples > 0 && (
        <div className="adm-note">
          There are <b>{s.samples} sample events</b> on the website (marked "Sample"). Add your real events, then remove the samples from{' '}
          <Link to="/admin/events?tab=all">Events</Link>.
        </div>
      )}
      <div className="adm-tiles">
        {tiles.map(([label, n, to, extra]) => (
          <Link key={label} to={to} className="adm-tile">
            <span className="adm-tile-label">{label}</span>
            <span className="adm-tile-num">{n}</span>
            {extra && <span className="adm-pill adm-pill-new">{extra}</span>}
          </Link>
        ))}
      </div>
      <section className="adm-card">
        <h2>Latest RSVPs</h2>
        {s.latestRsvps.length === 0 ? (
          <p className="adm-empty">No RSVPs yet.</p>
        ) : (
          <ul className="adm-list">
            {s.latestRsvps.map((r) => (
              <li key={r._id}>
                <b>{r.name}</b>
                <span className="adm-muted">
                  {r.eventTitle} · {formatDate(r.eventDate)}
                </span>
                <span className="adm-muted adm-right">{r.people || 1} {(r.people || 1) > 1 ? 'people' : 'person'}</span>
              </li>
            ))}
          </ul>
        )}
        <Link to="/admin/rsvps" className="adm-btn">
          All RSVPs
        </Link>
      </section>
    </>
  );
}
