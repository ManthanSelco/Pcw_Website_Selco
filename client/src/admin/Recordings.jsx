import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin, ConfirmButton } from './AdminApp.jsx';
import { Field, ImageUpload } from './Events.jsx';
import { formatDate, ytThumb } from '../api.js';

// Admin > Recordings: Podcasts, Reports, Videos shown on /recordings
const TYPES = [
  ['podcast', 'Podcasts', 'Podcast', 'podcasts'],
  ['report', 'Reports', 'Report', 'reports'],
  ['video', 'Videos', 'Video', 'videos'],
];
const MEDIA = { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud', apple: 'Apple Podcasts', drive: 'Google Drive', audio: 'Audio file', video: 'Video file', pdf: 'PDF' };
const one = (t) => TYPES.find((x) => x[0] === t)?.[2] || t;

function ytId(url) {
  const s = String(url || '').trim();
  const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/) || s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || s.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}
// Same rules as the server: what will the website do with this link?
function linkKind(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (ytId(s)) return 'YouTube: plays on the website';
  let u;
  try {
    u = new URL(s);
  } catch {
    return 'Not a full link yet (it must start with https://)';
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'open.spotify.com') return 'Spotify: plays on the website';
  if (host.endsWith('soundcloud.com')) return 'SoundCloud: plays on the website';
  if (host === 'podcasts.apple.com') return 'Apple Podcasts: plays on the website';
  if (host === 'drive.google.com') return 'Google Drive: opens on the website (file must be shared as "Anyone with the link")';
  if (/\.(mp3|m4a|wav|ogg|aac)$/i.test(u.pathname)) return 'Audio file: plays on the website';
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return 'Video file: plays on the website';
  if (/\.pdf$/i.test(u.pathname)) return 'PDF: opens in a new tab';
  return 'Web page: opens in a new tab';
}

const isUploaded = (link) => /^\/files\/[a-f0-9-]{36}\.(pdf|docx?|pptx?)$/i.test(link || '');
const mb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : '');
const MAX_MB = 50;

// Upload a report file (PDF, Word, PowerPoint, max 50 MB). Bigger files: share a link instead.
function DocUpload({ value, onChange }) {
  const input = useRef(null);
  const [pct, setPct] = useState(null);
  const [err, setErr] = useState('');
  function pick(file) {
    setErr('');
    if (!file) return;
    if (!/\.(pdf|docx?|pptx?)$/i.test(file.name)) return setErr('Please choose a PDF, Word (.doc/.docx) or PowerPoint (.ppt/.pptx) file.');
    if (file.size > MAX_MB * 1024 * 1024)
      return setErr(`This file is ${mb(file.size)}, more than ${MAX_MB} MB. Use a Google Drive (or other) share link instead, as explained below.`);
    const fd = new FormData();
    fd.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/upload-doc');
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => e.lengthComputable && setPct(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      setPct(null);
      let body = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* not JSON (e.g. the server's upload limit) */
      }
      if (xhr.status === 200 && body.url) onChange({ url: body.url, name: body.name, size: body.size });
      else setErr(body.error || (xhr.status === 413 ? `The file is too large for the server. Use a share link instead.` : 'Upload failed. Please try again.'));
    };
    xhr.onerror = () => {
      setPct(null);
      setErr('Upload failed. Check the internet connection and try again.');
    };
    setPct(0);
    xhr.send(fd);
  }
  return (
    <div className="adm-field is-wide adm-doc">
      <span className="adm-label">Upload report</span>
      {value ? (
        <div className="adm-doc-file">
          <span className="adm-doc-icon" aria-hidden="true">
            {value.url.split('.').pop().toUpperCase()}
          </span>
          <span className="adm-doc-name">
            <b>{value.name || 'Uploaded file'}</b>
            <small>{mb(value.size)}</small>
          </span>
          <a className="adm-btn adm-btn-ghost" href={value.url} target="_blank" rel="noreferrer">
            Open
          </a>
          <button type="button" className="adm-btn" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      ) : (
        <div className="adm-doc-drop">
          <button type="button" className="adm-btn" disabled={pct !== null} onClick={() => input.current?.click()}>
            {pct !== null ? `Uploading… ${pct}%` : 'Choose file'}
          </button>
          <span className="adm-hint">PDF, Word or PowerPoint · up to {MAX_MB} MB</span>
          {pct !== null && (
            <span className="adm-doc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${pct}%` }} />
            </span>
          )}
        </div>
      )}
      <input
        ref={input}
        type="file"
        hidden
        accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {err && <span className="adm-field-error">{err}</span>}
      <div className="adm-note adm-doc-note">
        <b>File bigger than {MAX_MB} MB?</b> Upload it to Google Drive (or OneDrive, Dropbox or another sharing site), set sharing to{' '}
        <b>“Anyone with the link can view”</b>, copy the link and paste it in <b>Report link</b> below.
      </div>
    </div>
  );
}

const blank = (type = 'podcast') => ({
  type,
  title: '',
  number: '',
  speakers: '',
  category: '',
  city: '',
  date: '',
  link: '',
  image: '',
  description: '',
  published: true,
  fileName: '',
  fileSize: 0,
});

function Editor({ initial, meta, onSaved, onCancel }) {
  const { call, notify } = useAdmin();
  const [f, setF] = useState(() => ({ ...blank(), ...initial }));
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const uploads = useRef([]); // photos uploaded in this form; unused ones are deleted from S3
  const docUploads = useRef([]); // reports uploaded in this form; unused ones are deleted
  const discardUnused = (keep, keepDoc) => {
    for (const url of uploads.current) if (url !== keep && url !== initial.image) call('/api/admin/upload/discard', { url }).catch(() => {});
    uploads.current = [];
    for (const url of docUploads.current) if (url !== keepDoc && url !== initial.link) call('/api/admin/upload-doc/discard', { url }).catch(() => {});
    docUploads.current = [];
  };
  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const yid = ytId(f.link);
  const label = one(f.type);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = f._id ? await call(`/api/admin/recordings/${f._id}`, f, 'PUT') : await call('/api/admin/recordings', f);
      discardUnused(saved.image, saved.link);
      notify(f._id ? `${label} updated` : `${label} added`);
      onSaved(saved);
    } catch (x) {
      setErrors(x.errors || {});
      notify(x.message, 'err');
      setTimeout(() => document.querySelector('.adm-field.has-error input, .adm-field.has-error select')?.focus(), 0);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    await call(`/api/admin/recordings/${f._id}`, undefined, 'DELETE');
    notify(`${label} deleted`);
    onSaved(null);
  }

  return (
    <form className="adm-card adm-form" onSubmit={save} noValidate>
      <div className="adm-head adm-head-sm">
        <h2>{f._id ? `Edit ${label.toLowerCase()}` : `Add ${label.toLowerCase()}`}</h2>
        {f.sample && <span className="adm-pill adm-pill-warn">Sample</span>}
      </div>
      <div className="adm-grid">
        <div className="adm-field is-wide">
          <span className="adm-label">Type *</span>
          <div className="adm-radios" role="radiogroup">
            {TYPES.map(([v, , l]) => (
              <label key={v} className={f.type === v ? 'is-on' : ''}>
                <input type="radio" name="type" value={v} checked={f.type === v} onChange={() => set('type', v)} />
                {l}
              </label>
            ))}
          </div>
          {errors.type && <span className="adm-field-error">{errors.type}</span>}
        </div>
        <Field label="Title *" error={errors.title} wide>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
        </Field>
        <Field label={f.type === 'podcast' ? 'Episode number' : 'Number (optional)'} error={errors.number} hint="Shown before the title, e.g. 12.">
          <input inputMode="numeric" value={f.number} onChange={(e) => set('number', e.target.value.replace(/[^\d]/g, ''))} maxLength={6} />
        </Field>
        <Field label="Date" error={errors.date} hint="Newest date shows first">
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <Field
          label={f.type === 'report' ? 'Authors (one line)' : 'Speakers (one line)'}
          error={errors.speakers}
          wide
          hint={f.type === 'report' ? 'e.g. PCW team' : 'e.g. Guest name and Guest name, with Host name'}
        >
          <input value={f.speakers} onChange={(e) => set('speakers', e.target.value)} maxLength={300} />
        </Field>
        <Field label="Category" error={errors.category} hint="Used for the filter on the website">
          <input list="adm-rec-cats" value={f.category} onChange={(e) => set('category', e.target.value)} maxLength={60} />
          <datalist id="adm-rec-cats">
            {meta.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="City" error={errors.city}>
          <select value={f.city} onChange={(e) => set('city', e.target.value)}>
            <option value="">Both / not city-specific</option>
            {Object.entries(meta.cities).map(([k, c]) => (
              <option key={k} value={k}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {f.type === 'report' && (
          <DocUpload
            value={isUploaded(f.link) ? { url: f.link, name: f.fileName, size: f.fileSize } : null}
            onChange={(d) => {
              if (d) docUploads.current.push(d.url);
              setF((x) => ({ ...x, link: d ? d.url : '', fileName: d ? d.name : '', fileSize: d ? d.size : 0 }));
              setErrors((e) => ({ ...e, link: undefined }));
            }}
          />
        )}
        <Field
          label={f.type === 'report' ? (isUploaded(f.link) ? 'Report link (using the uploaded file)' : 'Report link') : f.type === 'video' ? 'Video link' : 'Podcast link'}
          error={errors.link}
          wide
          hint={
            linkKind(f.link) ||
            (f.type === 'report'
              ? 'Or paste a link: Google Drive, OneDrive, Dropbox, a PDF or any web page'
              : f.type === 'video'
                ? 'Any video link: YouTube, Vimeo, Google Drive, .mp4 or any other site'
                : 'YouTube, Spotify, SoundCloud, Apple Podcasts, Google Drive or .mp3 link')
          }
        >
          <input
            value={isUploaded(f.link) ? '' : f.link}
            onChange={(e) => setF((x) => ({ ...x, link: e.target.value.trim(), fileName: '', fileSize: 0 }))}
            placeholder={isUploaded(f.link) ? 'Uploaded file is used (paste a link here to use a link instead)' : 'https://…'}
            inputMode="url"
          />
        </Field>
        {yid && !f.image && (
          <div className="adm-field is-wide adm-yt-preview">
            <img src={ytThumb(yid)} alt="" />
            <span>No cover photo: the YouTube thumbnail will be used.</span>
          </div>
        )}
        <div className="adm-field is-wide">
          <span className="adm-label">Cover photo</span>
          <ImageUpload value={f.image} onChange={(v) => set('image', v)} onUploaded={(u) => uploads.current.push(u)} />
          {errors.image && <span className="adm-field-error">{errors.image}</span>}
        </div>
        <Field label="About (optional)" error={errors.description} wide hint="Shown in the player window">
          <textarea rows={4} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={3000} />
        </Field>
        <label className="adm-check is-wide">
          <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
          Show on website
        </label>
      </div>
      <div className="adm-row adm-form-foot">
        <button className="adm-btn adm-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : f._id ? 'Save changes' : `Add ${label.toLowerCase()}`}
        </button>
        <button
          type="button"
          className="adm-btn adm-btn-ghost"
          onClick={() => {
            discardUnused(initial.image, initial.link);
            onCancel();
          }}
        >
          Cancel
        </button>
        {f._id && (
          <span className="adm-right">
            <ConfirmButton onConfirm={remove}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </form>
  );
}

export default function Recordings() {
  const { call, notify, path, go } = useAdmin();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const tab = TYPES.find((t) => t[0] === params.get('type'))?.[0] || 'podcast';
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(() => call('/api/admin/recordings').then(setData).catch(() => {}), [call]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="adm-loading" />;
  const meta = { cities: data.cities, categories: [...new Set(data.recordings.map((x) => x.category).filter(Boolean))].sort() };
  const samples = data.recordings.filter((x) => x.sample).length;
  const s = q.trim().toLowerCase();
  const list = data.recordings.filter((x) => x.type === tab && (!s || `${x.number} ${x.title} ${x.speakers} ${x.category}`.toLowerCase().includes(s)));
  const tabInfo = TYPES.find((t) => t[0] === tab);

  async function deleteSamples() {
    const r = await call('/api/admin/recordings/delete-samples', {});
    notify(`${r.deleted} sample items deleted`);
    load();
  }

  if (edit)
    return (
      <>
        <div className="adm-head">
          <h1>Recordings</h1>
        </div>
        <Editor
          initial={edit}
          meta={meta}
          onCancel={() => setEdit(null)}
          onSaved={(saved) => {
            setEdit(null);
            if (saved?.type && saved.type !== tab) go(`/admin/recordings?type=${saved.type}`);
            load();
            window.scrollTo(0, 0);
          }}
        />
      </>
    );

  return (
    <>
      <div className="adm-head">
        <h1>Recordings</h1>
        <button className="adm-btn adm-btn-primary" onClick={() => setEdit(blank(tab))}>
          + Add {tabInfo[2].toLowerCase()}
        </button>
      </div>
      <p className="adm-muted adm-intro">
        Podcasts, reports and videos on the website's Recordings page.{' '}
        <a href={`/recordings/${tabInfo[3]}`} target="_blank" rel="noreferrer">
          View page ↗
        </a>
        {tab === 'video' && ' Event videos (YouTube link on an event) also show there automatically.'}
      </p>
      {samples > 0 && (
        <div className="adm-note adm-row">
          <span>
            <b>{samples} sample items</b> are showing on the Recordings page. Delete them when your real ones are in.
          </span>
          <span className="adm-right">
            <ConfirmButton onConfirm={deleteSamples} confirmText={`Yes, delete ${samples} samples`}>
              Delete all samples
            </ConfirmButton>
          </span>
        </div>
      )}
      <div className="adm-tabs" role="tablist">
        {TYPES.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => go(`/admin/recordings?type=${k}`)}>
            {l} ({data.recordings.filter((x) => x.type === k).length})
          </button>
        ))}
      </div>
      <div className="adm-filters">
        <input type="search" placeholder={`Search ${tabInfo[1].toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" />
      </div>
      <div className="adm-card adm-card-flush">
        {list.length === 0 ? (
          <p className="adm-empty">No {tabInfo[1].toLowerCase()} yet. Use “+ Add {tabInfo[2].toLowerCase()}”.</p>
        ) : (
          <ul className="adm-events">
            {list.map((x) => {
              const yt = ytId(x.link);
              return (
                <li key={x._id}>
                  <div className="adm-ev-thumb">{x.image ? <img src={x.image} alt="" /> : yt ? <img src={ytThumb(yt)} alt="" /> : <span>{tabInfo[2].slice(0, 3)}</span>}</div>
                  <div className="adm-ev-main">
                    <button className="adm-ev-title" onClick={() => setEdit(x)}>
                      {x.number ? `${x.number}. ` : ''}
                      {x.title}
                    </button>
                    <span className="adm-muted">{[x.speakers, data.cities[x.city]?.name, x.category, x.date && formatDate(x.date)].filter(Boolean).join(' · ')}</span>
                    <span className="adm-badges">
                      {x.sample && <span className="adm-pill adm-pill-warn">Sample</span>}
                      {x.published === false && <span className="adm-pill">Hidden</span>}
                      {x.link ? <span className="adm-pill adm-pill-ok">{MEDIA[x.media] || 'Link'}</span> : <span className="adm-pill">No link yet</span>}
                    </span>
                  </div>
                  <div className="adm-ev-actions">
                    <button className="adm-btn" onClick={() => setEdit(x)}>
                      Edit
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
