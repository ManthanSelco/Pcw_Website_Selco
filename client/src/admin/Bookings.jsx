import { useCallback, useEffect, useState } from 'react';
import { useAdmin, ConfirmButton } from './AdminApp.jsx';
import { formatDate } from '../api.js';

export default function Bookings() {
  const { call, notify } = useAdmin();
  const [data, setData] = useState(null);
  const load = useCallback(() => call('/api/admin/bookings').then(setData).catch(() => {}), [call]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <>
      <div className="adm-head">
        <h1>Space bookings</h1>
        <a className="adm-btn" href="/api/admin/bookings.csv">
          Download Excel (CSV)
        </a>
      </div>
      <p className="adm-note">On the website, "Book the space" shows <b>Coming soon</b> for now, so no new requests will come in until booking is switched on.</p>
      <div className="adm-card adm-card-flush adm-table-wrap">
        {!data ? (
          <div className="adm-loading" />
        ) : data.bookings.length === 0 ? (
          <p className="adm-empty">No booking requests.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>City</th>
                <th>Purpose</th>
                <th>Date · People</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.bookings.map((b) => (
                <tr key={b._id}>
                  <td data-label="Name">
                    <b>{b.name}</b>
                    {b.organisation && (
                      <>
                        <br />
                        <span className="adm-muted">{b.organisation}</span>
                      </>
                    )}
                  </td>
                  <td data-label="Contact">
                    <a href={`mailto:${b.email}`}>{b.email}</a>
                    <br />
                    <a href={`tel:${b.phone}`}>{b.phone}</a>
                  </td>
                  <td data-label="City" style={{ textTransform: 'capitalize' }}>{b.city}</td>
                  <td data-label="Purpose">
                    {b.purpose}
                    {b.message && (
                      <>
                        <br />
                        <span className="adm-muted">{b.message}</span>
                      </>
                    )}
                  </td>
                  <td data-label="Date · People">
                    {b.date ? formatDate(b.date) : '—'} · {b.people || '—'}
                  </td>
                  <td data-label="Status">
                    <select
                      value={b.status}
                      aria-label="Status"
                      onChange={async (e) => {
                        await call(`/api/admin/bookings/${b._id}`, { status: e.target.value }, 'PATCH');
                        notify('Status updated');
                        load();
                      }}
                    >
                      {data.statuses.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td data-label="">
                    <ConfirmButton
                      className="adm-btn adm-btn-ghost adm-btn-danger"
                      confirmText="Confirm"
                      onConfirm={async () => {
                        await call(`/api/admin/bookings/${b._id}`, undefined, 'DELETE');
                        notify('Removed');
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
