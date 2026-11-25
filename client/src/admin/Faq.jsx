import { useCallback, useEffect, useState } from 'react';
import { useAdmin, ConfirmButton } from './AdminApp.jsx';

// Admin > FAQ: questions shown on /faq, in Google (FAQ data) and in llms.txt for AI assistants.
export default function Faq() {
  const { call, notify } = useAdmin();
  const [items, setItems] = useState(null);
  const [saved, setSaved] = useState('[]');
  const [defaults, setDefaults] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      call('/api/admin/faq').then((d) => {
        setItems(d.items);
        setSaved(JSON.stringify(d.items));
        setDefaults(d.defaults || []);
      }),
    [call]
  );
  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  if (!items) return <div className="adm-loading" />;
  const dirty = JSON.stringify(items) !== saved;
  const set = (i, k, v) => {
    setItems((list) => list.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    setErrors((e) => ({ ...e, [`${k}${i}`]: undefined }));
  };
  const move = (i, d) =>
    setItems((list) => {
      const out = [...list];
      [out[i], out[i + d]] = [out[i + d], out[i]];
      return out;
    });

  async function save() {
    setBusy(true);
    try {
      const d = await call('/api/admin/faq', { items }, 'PUT');
      setItems(d.items);
      setSaved(JSON.stringify(d.items));
      setErrors({});
      notify('FAQ saved');
    } catch (x) {
      setErrors(x.errors || {});
      notify(x.message, 'err');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="adm-head">
        <h1>FAQ</h1>
        <a className="adm-btn adm-btn-ghost" href="/faq" target="_blank" rel="noreferrer">
          View page ↗
        </a>
      </div>
      <p className="adm-muted adm-intro">
        Questions and answers on the website's FAQ page. Google and AI assistants (ChatGPT, Perplexity, Gemini) read these to answer questions about PCW,
        so write each answer as one clear, complete sentence or two. Links and emails become clickable.
      </p>
      <div className="adm-faq-list">
        {items.map((x, i) => (
          <div key={i} className="adm-card adm-faq-row">
            <div className="adm-faq-num">{i + 1}</div>
            <div className="adm-faq-fields">
              <label className={`adm-field is-wide ${errors[`q${i}`] ? 'has-error' : ''}`}>
                <span className="adm-label">Question</span>
                <input value={x.q} maxLength={300} onChange={(e) => set(i, 'q', e.target.value)} />
                {errors[`q${i}`] && <span className="adm-field-error">{errors[`q${i}`]}</span>}
              </label>
              <label className={`adm-field is-wide ${errors[`a${i}`] ? 'has-error' : ''}`}>
                <span className="adm-label">Answer</span>
                <textarea rows={3} value={x.a} maxLength={3000} onChange={(e) => set(i, 'a', e.target.value)} />
                {errors[`a${i}`] && <span className="adm-field-error">{errors[`a${i}`]}</span>}
              </label>
            </div>
            <div className="adm-faq-actions">
              <button type="button" className="adm-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move question ${i + 1} up`}>
                ↑
              </button>
              <button type="button" className="adm-btn" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Move question ${i + 1} down`}>
                ↓
              </button>
              <button type="button" className="adm-btn" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="adm-row adm-form-foot adm-faq-foot">
        <button type="button" className="adm-btn" onClick={() => setItems((l) => [...l, { q: '', a: '' }])}>
          + Add question
        </button>
        <button type="button" className="adm-btn adm-btn-primary" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : dirty ? 'Save FAQ' : 'Saved'}
        </button>
        {dirty && (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setItems(JSON.parse(saved))}>
            Undo changes
          </button>
        )}
        <span className="adm-right">
          <ConfirmButton onConfirm={() => setItems(defaults)} confirmText="Yes, put the starting questions back (then Save)">
            Reset to starting questions
          </ConfirmButton>
        </span>
      </div>
    </>
  );
}
