import { useCallback, useEffect, useState } from 'react';
import { useAdmin, ConfirmButton } from './AdminApp.jsx';
import { formatDate } from '../api.js';

export default function Rsvps() {
  const { call, notify, path, go } = useAdmin();
  const eventId = new URLSearchParams(path.split('?')[1] || '').get('event') || '';
  const [rows, setRows] = useState(null);
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    call(`/api/admin/rsvps${eventId ? `?eventId=${eventId}` : ''}`)
      .then((d) => setRows(d.rsvps))
      .catch(() => {});
  }, [call, eventId]);
  useEffect(() => {
    load();
    call('/api/admin/events')
      .then((d) => setEvents(d.events))
      .catch(() => {});
  }, [load, call]);

  const s = q.trim().toLowerCase();
  const shown = (rows || []).filter((r) => !s || [r.name, r.email, r.phone, r.organisation, r.eventTitle].join(' ').toLowerCase().includes(s));
  const people = shown.reduce((n, r) => n + (r.people || 1), 0);
  const csv = `/api/admin/rsvps.csv${eventId ? `?eventId=${eventId}` : ''}`;

  return (
    <>
      <div className="adm-head">
        <h1>RSVPs</h1>
        <a className="adm-btn" href={csv}>
          Download Excel (CSV)
        </a>
      </div>
      <div className="adm-filters">
        <select value={eventId} onChange={(e) => go(`/admin/rsvps${e.target.value ? `?event=${e.target.value}` : ''}`)} aria-label="Event">
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e._id} value={e._id}>
              {formatDate(e.date)} · {e.title}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search name, email, phone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search RSVPs" />
        <span className="adm-muted">
          {shown.length} RSVP{shown.length === 1 ? '' : 's'} · {people} {people === 1 ? 'person' : 'people'}
        </span>
      </div>
      <div className="adm-card adm-card-flush adm-table-wrap">
        {!rows ? (
          <div className="adm-loading" />
        ) : shown.length === 0 ? (
          <p className="adm-empty">No RSVPs yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Organisation</th>
                <th>People</th>
                {!eventId && <th>Event</th>}
                <th>Received</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r._id}>
                  <td data-label="Name">
                    <b>{r.name}</b>
                  </td>
                  <td data-label="Email">
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td data-label="Phone">{r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : '—'}</td>
                  <td data-label="Organisation">{r.organisation || '—'}</td>
                  <td data-label="People">{r.people || 1}</td>
                  {!eventId && (
                    <td data-label="Event">
                      {r.eventTitle}
                      <br />
                      <span className="adm-muted">{formatDate(r.eventDate)}</span>
                    </td>
                  )}
                  <td data-label="Received" className="adm-muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td data-label="">
                    <ConfirmButton
                      className="adm-btn adm-btn-ghost adm-btn-danger"
                      confirmText="Confirm"
                      onConfirm={async () => {
                        await call(`/api/admin/rsvps/${r._id}`, undefined, 'DELETE');
                        notify('RSVP removed');
                        load();
                      }}
                    >
                      Remove
                    </ConfirmButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
