import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin } from './AdminApp.jsx';
import { ImageUpload } from './Events.jsx';

// "A Space to Connect in Person" section on each city page
function SpaceForm({ space, cityName, onSaved }) {
  const { call, notify } = useAdmin();
  const [f, setF] = useState(space);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const uploads = useRef([]);
  useEffect(() => setF(space), [space]);
  const card = (i, k, v) => setF((s) => ({ ...s, cards: s.cards.map((c, j) => (j === i ? { ...c, [k]: v } : c)) }));
  const dirty = JSON.stringify(f) !== JSON.stringify(space);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = await call(`/api/admin/spaces/${space.city}`, f, 'PUT');
      for (const u of uploads.current) if (!saved.cards.some((c) => c.image === u)) call('/api/admin/upload/discard', { url: u }).catch(() => {});
      uploads.current = [];
      setErrors({});
      notify(`${cityName} space saved`);
      onSaved(saved);
    } catch (x) {
      setErrors(x.errors || {});
      notify(x.message, 'err');
    } finally {
      setBusy(false);
    }
  }
  function reset() {
    for (const u of uploads.current) if (!space.cards.some((c) => c.image === u)) call('/api/admin/upload/discard', { url: u }).catch(() => {});
    uploads.current = [];
    setF(space);
  }

  return (
    <form className="adm-card adm-form" onSubmit={save} noValidate>
      <div className="adm-head adm-head-sm">
        <h2>{cityName} space</h2>
        <a className="adm-btn adm-btn-ghost" href={`/space/${space.city}#the-space`} target="_blank" rel="noreferrer">
          View on website ↗
        </a>
      </div>
      <div className="adm-grid">
        <div className={`adm-field is-wide ${errors.title ? 'has-error' : ''}`}>
          <label>
            <span className="adm-label">Heading</span>
            <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} />
          </label>
          {errors.title && <span className="adm-field-error">{errors.title}</span>}
        </div>
        <div className="adm-field is-wide">
          <label>
            <span className="adm-label">Short intro</span>
            <textarea rows={2} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} maxLength={600} />
          </label>
        </div>
        {f.cards.map((c, i) => (
          <fieldset key={i} className="adm-space-card is-wide">
            <legend>Card {i + 1}</legend>
            <div className={`adm-field ${errors[`card${i}`] ? 'has-error' : ''}`}>
              <label>
                <span className="adm-label">Title</span>
                <input value={c.title} onChange={(e) => card(i, 'title', e.target.value)} maxLength={80} />
              </label>
              {errors[`card${i}`] && <span className="adm-field-error">{errors[`card${i}`]}</span>}
            </div>
            <div className="adm-field">
              <label>
                <span className="adm-label">Text</span>
                <textarea rows={3} value={c.text} onChange={(e) => card(i, 'text', e.target.value)} maxLength={400} />
              </label>
            </div>
            <div className="adm-field">
              <span className="adm-label">Photo of the space</span>
              <ImageUpload value={c.image} onChange={(v) => card(i, 'image', v)} onUploaded={(u) => uploads.current.push(u)} />
              {!c.image && <span className="adm-hint">No photo yet: the website shows "Photo coming soon".</span>}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="adm-row adm-form-foot">
        <button className="adm-btn adm-btn-primary" disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {dirty && (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={reset}>
            Undo changes
          </button>
        )}
      </div>
    </form>
  );
}

export default function Spaces() {
  const { call } = useAdmin();
  const [data, setData] = useState(null);
  const [city, setCity] = useState('bangalore');
  const load = useCallback(() => call('/api/admin/spaces').then(setData).catch(() => {}), [call]);
  useEffect(() => {
    load();
  }, [load]);
  if (!data) return <div className="adm-loading" />;
  const space = data.spaces.find((s) => s.city === city);
  return (
    <>
      <div className="adm-head">
        <h1>City spaces</h1>
      </div>
      <p className="adm-muted adm-intro">The "A Space to Connect in Person" section on each city page: heading, three cards and their photos.</p>
      <div className="adm-tabs" role="tablist">
        {data.spaces.map((s) => (
          <button key={s.city} role="tab" aria-selected={city === s.city} className={city === s.city ? 'is-on' : ''} onClick={() => setCity(s.city)}>
            {data.cities[s.city]?.name}
            {s.cards.some((c) => !c.image) && <span className="adm-pill adm-pill-warn adm-tab-pill">photos needed</span>}
          </button>
        ))}
      </div>
      <SpaceForm
        key={city}
        space={space}
        cityName={data.cities[city]?.name}
        onSaved={(saved) => setData((d) => ({ ...d, spaces: d.spaces.map((s) => (s.city === saved.city ? saved : s)) }))}
      />
    </>
  );
}
