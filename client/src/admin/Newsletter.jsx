import { useCallback, useEffect, useState } from 'react';
import { useAdmin, ConfirmButton } from './AdminApp.jsx';

export default function Newsletter() {
  const { call, notify } = useAdmin();
  const [rows, setRows] = useState(null);
  const load = useCallback(() => call('/api/admin/newsletter').then((d) => setRows(d.subscribers)).catch(() => {}), [call]);
  useEffect(() => {
    load();
  }, [load]);
  return (
    <>
      <div className="adm-head">
        <h1>Newsletter</h1>
        <a className="adm-btn" href="/api/admin/newsletter.csv">
          Download Excel (CSV)
        </a>
      </div>
      <p className="adm-muted adm-intro">Emails from the "Join our Newsletter" box in the website footer.</p>
      <div className="adm-card adm-card-flush adm-table-wrap">
        {!rows ? (
          <div className="adm-loading" />
        ) : rows.length === 0 ? (
          <p className="adm-empty">No subscribers yet.</p>
        ) : (
          <table className="adm-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Joined</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r._id}>
                  <td data-label="Email">
                    <a href={`mailto:${r.email}`}>{r.email}</a>
                  </td>
                  <td data-label="Joined" className="adm-muted">{new Date(r.createdAt).toLocaleDateString('en-IN')}</td>
                  <td data-label="">
                    <ConfirmButton
                      className="adm-btn adm-btn-ghost adm-btn-danger"
                      confirmText="Confirm"
                      onConfirm={async () => {
                        await call(`/api/admin/newsletter/${r._id}`, undefined, 'DELETE');
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
