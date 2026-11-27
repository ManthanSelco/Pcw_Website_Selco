import { useCallback, useEffect, useRef, useState } from 'react';
import { useAdmin, Link, ConfirmButton } from './AdminApp.jsx';
import { formatDate, timeRange, ytThumb } from '../api.js';
import { DOC_MAX_MB, DOC_ACCEPT, fileSize, checkDoc, uploadDoc } from './docUpload.js';

const VENUES = { bangalore: 'PCW Space, Bengaluru', guwahati: 'PCW Space, Guwahati' };

function ytId(url) {
  const s = String(url || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/[?&]v=([A-Za-z0-9_-]{11})/) || s.match(/youtu\.be\/([A-Za-z0-9_-]{11})/) || s.match(/youtube(?:-nocookie)?\.com\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : '';
}

const blank = (city = 'bangalore') => ({
  city,
  title: '',
  tagline: '',
  category: 'Talks',
  date: '',
  startTime: '',
  endTime: '',
  venue: VENUES[city],
  image: '',
  youtubeUrl: '',
  contentType: '',
  description: '',
  speakers: [],
  attachments: [],
  report: null,
  rsvp: 'open',
  rsvpUrl: '',
  capacity: '',
  published: true,
});

// what the website will do with a video link (same rules as the server)
function videoHint(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (ytId(s)) return 'YouTube: plays on the event page';
  let u;
  try {
    u = new URL(s);
  } catch {
    return 'Not a full link yet (it must start with https://)';
  }
  const host = u.hostname.replace(/^www\./, '');
  if (host === 'vimeo.com' || host === 'player.vimeo.com') return 'Vimeo: plays on the event page';
  if (host === 'drive.google.com') return 'Google Drive: plays on the event page (share it as "Anyone with the link")';
  if (/\.(mp4|webm|mov)$/i.test(u.pathname)) return 'Video file: plays on the event page';
  if (host === 'open.spotify.com') return 'Spotify: plays on the event page';
  if (host === 'soundcloud.com' || host === 'on.soundcloud.com') return 'SoundCloud: plays on the event page';
  if (host === 'podcasts.apple.com') return 'Apple Podcasts: plays on the event page';
  if (/\.(mp3|m4a|wav|ogg|aac)$/i.test(u.pathname)) return 'Audio file: plays on the event page';
  return 'Opens in a new tab from the event page ("Watch / Listen" button)';
}

export function Field({ label, error, hint, children, wide }) {
  return (
    <div className={`adm-field ${wide ? 'is-wide' : ''} ${error ? 'has-error' : ''}`}>
      <label>
        <span className="adm-label">{label}</span>
        {children}
      </label>
      {hint && !error && <span className="adm-hint">{hint}</span>}
      {error && <span className="adm-field-error">{error}</span>}
    </div>
  );
}

export function ImageUpload({ value, onChange, onUploaded }) {
  const { call } = useAdmin();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  async function pick(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('image', f);
      const r = await call('/api/admin/upload', fd);
      onUploaded?.(r.url);
      onChange(r.url);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="adm-image">
      <div className="adm-thumb">{value ? <img src={value} alt="" /> : <span>No photo</span>}</div>
      <div className="adm-image-btns">
        <label className="adm-btn">
          {busy ? 'Uploading…' : value ? 'Change photo' : 'Upload photo'}
          <input type="file" accept="image/*" hidden onChange={pick} disabled={busy} />
        </label>
        {value && (
          <button type="button" className="adm-btn adm-btn-ghost" onClick={() => onChange('')}>
            Remove
          </button>
        )}
        <span className="adm-hint">JPG/PNG from phone or computer. It is compressed automatically and saved in the image storage (S3). Landscape (4:3) looks best.</span>
        {err && <span className="adm-field-error">{err}</span>}
      </div>
    </div>
  );
}

// Documents for the event page (agenda, slides, report…): uploaded files (max 50 MB) or share links.
function Attachments({ value, onChange, onUploaded, error }) {
  const input = useRef(null);
  const [pct, setPct] = useState(null);
  const [msg, setMsg] = useState('');
  const list = value || [];
  const MAX = 10;
  const update = (i, patch) => onChange(list.map((a, j) => (j === i ? { ...a, ...patch } : a)));

  async function pick(files) {
    setMsg('');
    const all = [...(files || [])];
    if (!all.length) return;
    let next = [...list];
    const problems = [];
    for (const file of all) {
      if (next.length >= MAX) {
        problems.push(`Up to ${MAX} documents per event.`);
        break;
      }
      const bad = checkDoc(file);
      if (bad) {
        problems.push(bad);
        continue;
      }
      try {
        const up = await uploadDoc(file, setPct);
        onUploaded?.(up.url);
        next = [...next, { url: up.url, name: up.name || file.name, size: up.size }];
        onChange(next);
      } catch (e) {
        problems.push(`${file.name}: ${e.message}`);
      }
    }
    setPct(null);
    setMsg(problems.join(' '));
  }

  return (
    <div className={`adm-field is-wide adm-doc ${error ? 'has-error' : ''}`}>
      <span className="adm-label">Documents (optional)</span>
      <span className="adm-hint adm-doc-lead">Shown on the event page under “Documents”, e.g. agenda, slides, report or reading material.</span>
      {list.length > 0 && (
        <ul className="adm-att-list">
          {list.map((a, i) => {
            const uploaded = a.url.startsWith('/files/');
            return (
              <li key={i} className="adm-att">
                <span className="adm-doc-icon" aria-hidden="true">
                  {uploaded ? a.url.split('.').pop().toUpperCase() : 'LINK'}
                </span>
                <span className="adm-att-fields">
                  <input aria-label={`Document ${i + 1} name`} placeholder="Name shown on the website" value={a.name} maxLength={150} onChange={(e) => update(i, { name: e.target.value })} />
                  {uploaded ? (
                    <small>{fileSize(a.size) || 'Uploaded file'}</small>
                  ) : (
                    <input aria-label={`Document ${i + 1} link`} placeholder="https://drive.google.com/…" inputMode="url" value={a.url === 'https://' ? '' : a.url} onChange={(e) => update(i, { url: e.target.value.trim() || 'https://' })} />
                  )}
                </span>
                {(uploaded || /^https?:\/\/.+\..+/.test(a.url)) && (
                  <a className="adm-btn adm-btn-ghost" href={a.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                )}
                <button type="button" className="adm-btn" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={`Remove ${a.name || 'document'}`}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="adm-doc-drop">
        <button type="button" className="adm-btn" disabled={pct !== null || list.length >= MAX} onClick={() => input.current?.click()}>
          {pct !== null ? `Uploading… ${pct}%` : 'Upload file'}
        </button>
        <button type="button" className="adm-btn adm-btn-ghost" disabled={pct !== null || list.length >= MAX} onClick={() => onChange([...list, { url: 'https://', name: '', size: 0 }])}>
          + Add a link
        </button>
        <span className="adm-hint">PDF, Word or PowerPoint · up to {DOC_MAX_MB} MB each · max {MAX}</span>
        {pct !== null && (
          <span className="adm-doc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <i style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>
      <input
        ref={input}
        type="file"
        hidden
        multiple
        accept={DOC_ACCEPT}
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
      {(msg || error) && <span className="adm-field-error">{msg || error}</span>}
      <div className="adm-note adm-doc-note">
        <b>File bigger than {DOC_MAX_MB} MB?</b> Upload it to Google Drive (or OneDrive, Dropbox or another sharing site), set sharing to{' '}
        <b>“Anyone with the link can view”</b>, copy the link, click <b>+ Add a link</b> and paste it.
      </div>
    </div>
  );
}

// Popup for Content type > Report: one report file (PDF / Word / PowerPoint, max 50 MB) or a share link.
function ReportDialog({ value, eventTitle, onSave, onCancel, onUploaded }) {
  const uploadedNow = value?.url?.startsWith('/files/');
  const [mode, setMode] = useState(value && !uploadedNow ? 'link' : 'file');
  const [file, setFile] = useState(uploadedNow ? value : null);
  const [link, setLink] = useState(value && !uploadedNow ? value.url : '');
  const [title, setTitle] = useState(value?.title || '');
  const [pct, setPct] = useState(null);
  const [err, setErr] = useState('');
  const input = useRef(null);
  const linkOk = /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(link);
  const ready = mode === 'file' ? !!file : linkOk;

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && pct === null && onCancel();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onCancel, pct]);

  function pick(f) {
    setErr('');
    if (!f) return;
    const bad = checkDoc(f);
    if (bad) return setErr(bad);
    uploadDoc(f, setPct)
      .then((up) => {
        onUploaded(up.url);
        setFile({ url: up.url, name: up.name || f.name, size: up.size });
      })
      .catch((e) => setErr(e.message))
      .finally(() => setPct(null));
  }
  function save() {
    if (!ready) return;
    const t = title.trim();
    onSave(mode === 'file' ? { ...file, title: t } : { url: link.trim(), name: t || 'Report', size: 0, title: t });
  }

  return (
    <div className="adm-dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && pct === null && onCancel()}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="report-dialog-title">
        <h3 id="report-dialog-title">Add the report</h3>
        <p className="adm-hint">It shows in Recordings &gt; Reports and on the event page (“Read the report”).</p>

        <label className="adm-field is-wide">
          <span className="adm-label">Report title</span>
          <input value={title} maxLength={200} placeholder={eventTitle || 'Same as the event title'} onChange={(e) => setTitle(e.target.value)} />
          <span className="adm-hint">Leave empty to use the event title.</span>
        </label>

        <div className="adm-radios adm-dialog-tabs" role="radiogroup" aria-label="Report source">
          {[
            ['file', 'Upload document'],
            ['link', 'Document link'],
          ].map(([v, l]) => (
            <label key={v} className={mode === v ? 'is-on' : ''}>
              <input type="radio" name="reportMode" checked={mode === v} onChange={() => (setMode(v), setErr(''))} />
              {l}
            </label>
          ))}
        </div>

        {mode === 'file' ? (
          <div className="adm-dialog-body">
            {file ? (
              <div className="adm-att">
                <span className="adm-doc-icon" aria-hidden="true">{file.url.split('.').pop().toUpperCase()}</span>
                <span className="adm-att-fields">
                  <b>{file.name}</b>
                  <small>{fileSize(file.size)}</small>
                </span>
                <a className="adm-btn adm-btn-ghost" href={file.url} target="_blank" rel="noreferrer">Open</a>
                <button type="button" className="adm-btn" onClick={() => setFile(null)}>Remove</button>
              </div>
            ) : (
              <div className="adm-doc-drop">
                <button type="button" className="adm-btn" disabled={pct !== null} onClick={() => input.current?.click()}>
                  {pct !== null ? `Uploading… ${pct}%` : 'Choose report file'}
                </button>
                <span className="adm-hint">One file · PDF, Word or PowerPoint · up to {DOC_MAX_MB} MB</span>
                {pct !== null && (
                  <span className="adm-doc-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                )}
              </div>
            )}
            <input ref={input} type="file" hidden accept={DOC_ACCEPT} onChange={(e) => (pick(e.target.files?.[0]), (e.target.value = ''))} />
          </div>
        ) : (
          <label className="adm-field is-wide adm-dialog-body">
            <span className="adm-label">Report link</span>
            <input value={link} inputMode="url" placeholder="https://drive.google.com/…" onChange={(e) => setLink(e.target.value.trim())} />
            {link && !linkOk && <span className="adm-field-error">Paste a full link starting with https://</span>}
          </label>
        )}
        {err && <span className="adm-field-error">{err}</span>}

        <div className="adm-note adm-doc-note">
          <b>Only the report document goes here</b> (PDF, Word or PowerPoint). Agenda, slides and other files go under “Documents”.
          <br />
          <b>Bigger than {DOC_MAX_MB} MB?</b> Upload it to Google Drive (or OneDrive, Dropbox…), set sharing to <b>“Anyone with the link can view”</b>, choose
          <b> Document link</b> and paste it.
        </div>

        <div className="adm-dialog-actions">
          <button type="button" className="adm-btn adm-btn-ghost" onClick={onCancel} disabled={pct !== null}>
            Cancel
          </button>
          <button type="button" className="adm-btn adm-btn-primary" onClick={save} disabled={!ready || pct !== null}>
            Save report
          </button>
        </div>
      </div>
    </div>
  );
}

function Editor({ initial, meta, onSaved, onCancel }) {
  const { call, notify } = useAdmin();
  const [f, setF] = useState(() => ({ ...blank(), ...initial, capacity: initial.capacity ?? '', speakers: initial.speakers || [], attachments: initial.attachments || [],
    // events saved before "Content type" existed show under Videos when they have a link
    contentType: initial.contentType ?? ((initial.youtubeUrl || initial.recordingUrl) ? 'video' : ''),
    report: initial.report || null,
  }));
  const [reportOpen, setReportOpen] = useState(false); // Content type > Report popup
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  // photos uploaded while this form is open; the ones not kept are deleted from storage (S3)
  const uploads = useRef([]);
  const docUploads = useRef([]); // documents uploaded while this form is open
  const discardUnused = (keep, keepDocs = [...(initial.attachments || []), ...(initial.report ? [initial.report] : [])]) => {
    for (const url of uploads.current) if (url !== keep && url !== initial.image) call('/api/admin/upload/discard', { url }).catch(() => {});
    uploads.current = [];
    const kept = new Set(keepDocs.map((a) => a.url));
    for (const url of docUploads.current) if (!kept.has(url)) call('/api/admin/upload-doc/discard', { url }).catch(() => {});
    docUploads.current = [];
  };
  const cancel = () => {
    discardUnused(initial.image);
    onCancel();
  };
  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const yid = ytId(f.youtubeUrl);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...f,
        capacity: f.capacity === '' ? null : Number(f.capacity),
        attachments: f.attachments.filter((a) => a.url && a.url !== 'https://'), // empty link rows are dropped
      };
      const saved = f._id ? await call(`/api/admin/events/${f._id}`, body, 'PUT') : await call('/api/admin/events', body);
      discardUnused(saved.image, [...(saved.attachments || []), ...(saved.report ? [saved.report] : [])]);
      notify(f._id ? 'Event updated' : 'Event added');
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
    await call(`/api/admin/events/${f._id}`, undefined, 'DELETE');
    notify('Event deleted');
    onSaved(null);
  }

  return (
    <form className="adm-card adm-form" onSubmit={save} noValidate>
      <div className="adm-head adm-head-sm">
        <h2>{f._id ? 'Edit event' : 'Add event'}</h2>
        {f.sample && <span className="adm-pill adm-pill-warn">Sample event</span>}
      </div>

      <div className="adm-grid">
        <Field label="City *" error={errors.city}>
          <select
            value={f.city}
            onChange={(e) => {
              const c = e.target.value;
              setF((s) => ({ ...s, city: c, venue: !s.venue || Object.values(VENUES).includes(s.venue) ? VENUES[c] : s.venue }));
            }}
          >
            {Object.entries(meta.cities).map(([k, c]) => (
              <option key={k} value={k}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category" error={errors.category}>
          <input list="adm-cats" value={f.category} onChange={(e) => set('category', e.target.value)} placeholder="Talks, Workshops…" />
          <datalist id="adm-cats">
            {meta.categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Title *" error={errors.title} wide>
          <input value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={160} />
        </Field>
        <Field label="One line about the event" error={errors.tagline} wide hint="Shown on the event card">
          <input value={f.tagline} onChange={(e) => set('tagline', e.target.value)} maxLength={300} />
        </Field>
        <Field label="Date *" error={errors.date}>
          <input type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
        </Field>
        <div className="adm-field adm-two">
          <Field label="Start time" error={errors.startTime}>
            <input type="time" value={f.startTime} onChange={(e) => set('startTime', e.target.value)} />
          </Field>
          <Field label="End time" error={errors.endTime}>
            <input type="time" value={f.endTime} onChange={(e) => set('endTime', e.target.value)} />
          </Field>
        </div>
        <Field label="Venue" error={errors.venue} wide>
          <input value={f.venue} onChange={(e) => set('venue', e.target.value)} />
        </Field>

        <div className="adm-field is-wide">
          <span className="adm-label">Photo</span>
          <ImageUpload value={f.image} onChange={(v) => set('image', v)} onUploaded={(u) => uploads.current.push(u)} />
          {errors.image && <span className="adm-field-error">{errors.image}</span>}
        </div>

        <Field
          label="Video / podcast recording link"
          error={errors.youtubeUrl}
          wide
          hint={videoHint(f.youtubeUrl) || 'Any link: YouTube, Vimeo, Google Drive, Spotify, SoundCloud, an .mp4/.mp3 file or any other site. It shows on the event page.'}
        >
          <input value={f.youtubeUrl} onChange={(e) => set('youtubeUrl', e.target.value.trim())} placeholder="https://…" inputMode="url" />
        </Field>
        {yid && (
          <div className="adm-field is-wide adm-yt-preview">
            <img src={ytThumb(yid)} alt="" />
            <span>
              Video found <b>({yid})</b>. It will play on the website.
            </span>
          </div>
        )}

        <div className={`adm-field is-wide ${errors.report ? 'has-error' : ''}`}>
          <span className="adm-label">Content type (optional)</span>
          <div className="adm-radios adm-radios-wrap" role="group" aria-label="Content type">
            {[
              ['video', 'Video'],
              ['podcast', 'Podcast'],
            ].map(([v, l]) => (
              <label key={v} className={f.contentType === v ? 'is-on' : ''}>
                <input type="checkbox" checked={f.contentType === v} onChange={(e) => set('contentType', e.target.checked ? v : '')} />
                {l}
              </label>
            ))}
            <label className={f.report ? 'is-on' : ''}>
              <input type="checkbox" checked={!!f.report} onChange={(e) => (e.target.checked ? setReportOpen(true) : set('report', null))} />
              Report
            </label>
          </div>
          <span className="adm-hint">
            {!f.contentType && !f.report
              ? 'Nothing ticked: shows only in Events (upcoming / past). Fine for upcoming events.'
              : [
                  f.contentType === 'video' && (f.youtubeUrl ? 'Also in Recordings > Videos.' : 'Video: add the recording link above to show it in Recordings > Videos.'),
                  f.contentType === 'podcast' && (f.youtubeUrl ? 'Also in Recordings > Podcasts.' : 'Podcast: add the recording link above to show it in Recordings > Podcasts.'),
                  f.report && 'Also in Recordings > Reports.',
                  'Always shown in Events too.',
                ]
                  .filter(Boolean)
                  .join(' ')}
          </span>
          {f.report && (
            <div className="adm-att adm-report-chip">
              <span className="adm-doc-icon" aria-hidden="true">
                {f.report.url.startsWith('/files/') ? f.report.url.split('.').pop().toUpperCase() : 'LINK'}
              </span>
              <span className="adm-att-fields">
                <b>Report: {f.report.title || f.title || 'same as the event title'}</b>
                <small>{f.report.url.startsWith('/files/') ? [f.report.name, fileSize(f.report.size)].filter(Boolean).join(' · ') : f.report.url}</small>
              </span>
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => setReportOpen(true)}>
                Change
              </button>
              <button type="button" className="adm-btn" onClick={() => set('report', null)}>
                Remove
              </button>
            </div>
          )}
          {errors.report && <span className="adm-field-error">{errors.report}</span>}
          {reportOpen && (
            <ReportDialog
              value={f.report}
              eventTitle={f.title}
              onUploaded={(u) => docUploads.current.push(u)}
              onCancel={() => setReportOpen(false)}
              onSave={(r) => {
                set('report', r);
                setReportOpen(false);
              }}
            />
          )}
        </div>

        <Field label="Description" error={errors.description} wide hint="Leave an empty line between paragraphs">
          <textarea rows={6} value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <Attachments value={f.attachments} onChange={(v) => set('attachments', v)} onUploaded={(u) => docUploads.current.push(u)} error={errors.attachments} />

        <div className="adm-field is-wide">
          <span className="adm-label">Speakers</span>
          {f.speakers.map((s, i) => (
            <div className="adm-speaker" key={i}>
              <input
                aria-label={`Speaker ${i + 1} name`}
                placeholder="Name"
                value={s.name}
                onChange={(e) => set('speakers', f.speakers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              />
              <input
                aria-label={`Speaker ${i + 1} role`}
                placeholder="Role / organisation"
                value={s.role}
                onChange={(e) => set('speakers', f.speakers.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))}
              />
              <button type="button" className="adm-btn adm-btn-ghost" onClick={() => set('speakers', f.speakers.filter((_, j) => j !== i))} aria-label="Remove speaker">
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="adm-btn" onClick={() => set('speakers', [...f.speakers, { name: '', role: '' }])}>
            + Add speaker
          </button>
        </div>

        <div className="adm-field is-wide">
          <span className="adm-label">Registration</span>
          <div className="adm-radios adm-radios-wrap" role="radiogroup" aria-label="Registration">
            {[
              ['open', 'Our RSVP form'],
              ['link', 'Form link (Google Form etc.)'],
              ['closed', 'Closed'],
              ['none', 'No registration'],
            ].map(([v, l]) => (
              <label key={v} className={f.rsvp === v ? 'is-on' : ''}>
                <input type="radio" name="rsvp" value={v} checked={f.rsvp === v} onChange={() => set('rsvp', v)} />
                {l}
              </label>
            ))}
          </div>
          <span className="adm-hint">
            {
              {
                open: 'People register on the website. You see them in RSVPs and can download them.',
                link: 'The Register button opens your form (Google Form, Microsoft Forms, Typeform, any link) in a new tab.',
                closed: 'Shows “RSVPs closed”.',
                none: 'No register button (open event, walk in).',
              }[f.rsvp]
            }
          </span>
        </div>
        {f.rsvp === 'link' && (
          <Field label="Form link *" error={errors.rsvpUrl} wide hint="Paste the link people should open to register, e.g. https://forms.gle/…">
            <input value={f.rsvpUrl || ''} onChange={(e) => set('rsvpUrl', e.target.value.trim())} placeholder="https://forms.gle/…" inputMode="url" />
          </Field>
        )}
        {f.rsvp === 'link' && f.rsvpUrl && /^https?:\/\//.test(f.rsvpUrl) && (
          <div className="adm-field is-wide">
            <a className="adm-btn adm-btn-ghost" href={f.rsvpUrl} target="_blank" rel="noreferrer">
              Test the form link ↗
            </a>
          </div>
        )}
        {f.rsvp === 'open' && (
          <Field label="Seats (optional)" error={errors.capacity} hint="RSVP closes when full">
            <input type="number" min="1" value={f.capacity ?? ''} onChange={(e) => set('capacity', e.target.value)} />
          </Field>
        )}
        <label className="adm-check is-wide">
          <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
          Show on website
        </label>
      </div>

      <div className="adm-row adm-form-foot">
        <button className="adm-btn adm-btn-primary" disabled={busy}>
          {busy ? 'Saving…' : f._id ? 'Save changes' : 'Add event'}
        </button>
        <button type="button" className="adm-btn adm-btn-ghost" onClick={cancel}>
          Cancel
        </button>
        {f._id && f.slug && f.published && (
          <a className="adm-btn adm-btn-ghost" href={`/event/${f.slug}`} target="_blank" rel="noreferrer">
            View on website ↗
          </a>
        )}
        {f._id && (
          <span className="adm-right">
            <ConfirmButton onConfirm={remove}>Delete event</ConfirmButton>
          </span>
        )}
      </div>
    </form>
  );
}

export default function Events() {
  const { call, notify, path, go } = useAdmin();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const tab = params.get('tab') || 'upcoming';
  const [data, setData] = useState(null);
  const [edit, setEdit] = useState(params.get('new') ? blank() : null);
  const [city, setCity] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => call('/api/admin/events').then(setData).catch(() => {}), [call]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) return <div className="adm-loading" />;
  const samples = data.events.filter((e) => e.sample).length;
  const s = q.trim().toLowerCase();
  let list = data.events.filter((e) => (tab === 'all' || e.when === tab) && (!city || e.city === city) && (!s || `${e.title} ${e.category} ${e.tagline}`.toLowerCase().includes(s)));
  if (tab === 'upcoming') list = [...list].reverse(); // soonest first

  async function deleteSamples() {
    const r = await call('/api/admin/events/delete-samples', {});
    notify(`${r.deleted} sample events deleted`);
    load();
  }

  if (edit)
    return (
      <>
        <div className="adm-head">
          <h1>Events</h1>
        </div>
        <Editor
          initial={edit}
          meta={data}
          onCancel={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
            window.scrollTo(0, 0);
          }}
        />
      </>
    );

  return (
    <>
      <div className="adm-head">
        <h1>Events</h1>
        <button className="adm-btn adm-btn-primary" onClick={() => setEdit(blank(city || 'bangalore'))}>
          + Add event
        </button>
      </div>
      {samples > 0 && (
        <div className="adm-note adm-row">
          <span>
            <b>{samples} sample events</b> are showing on the website. Delete them when your real events are in.
          </span>
          <span className="adm-right">
            <ConfirmButton onConfirm={deleteSamples} confirmText={`Yes, delete ${samples} samples`}>
              Delete all sample events
            </ConfirmButton>
          </span>
        </div>
      )}
      <div className="adm-tabs" role="tablist">
        {[
          ['upcoming', 'Upcoming'],
          ['past', 'Past'],
          ['all', 'All'],
        ].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => go(`/admin/events?tab=${k}`)}>
            {l} ({data.events.filter((e) => k === 'all' || e.when === k).length})
          </button>
        ))}
      </div>
      <div className="adm-filters">
        <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="City">
          <option value="">All cities</option>
          {Object.entries(data.cities).map(([k, c]) => (
            <option key={k} value={k}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Search events" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
      </div>
      <div className="adm-card adm-card-flush">
        {list.length === 0 ? (
          <p className="adm-empty">No events here yet.</p>
        ) : (
          <ul className="adm-events">
            {list.map((e) => (
              <li key={e._id}>
                <div className="adm-ev-thumb">{e.image ? <img src={e.image} alt="" /> : e.youtubeId ? <img src={ytThumb(e.youtubeId)} alt="" /> : <span>{data.cities[e.city]?.name.slice(0, 3)}</span>}</div>
                <div className="adm-ev-main">
                  <button className="adm-ev-title" onClick={() => setEdit(e)}>
                    {e.title}
                  </button>
                  <span className="adm-muted">
                    {data.cities[e.city]?.name} · {formatDate(e.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    {timeRange(e) ? ` · ${timeRange(e)}` : ''}
                    {e.category ? ` · ${e.category}` : ''}
                  </span>
                  <span className="adm-badges">
                    {e.sample && <span className="adm-pill adm-pill-warn">Sample</span>}
                    {e.published === false && <span className="adm-pill">Hidden</span>}
                    {e.hasVideo && <span className="adm-pill adm-pill-ok">Video</span>}
                    {e.when === 'upcoming' && e.rsvp !== 'none' && (
                      <span className="adm-pill">
                        {e.rsvp === 'closed' ? 'RSVP closed' : e.rsvp === 'link' ? 'Register: form link' : `RSVP open${e.capacity ? ` · ${e.capacity} seats` : ''}`}
                      </span>
                    )}
                  </span>
                </div>
                <div className="adm-ev-actions">
                  <Link to={`/admin/rsvps?event=${e._id}`} className="adm-btn adm-btn-ghost">
                    {e.rsvpCount} RSVP{e.rsvpCount === 1 ? '' : 's'}
                  </Link>
                  <button className="adm-btn" onClick={() => setEdit(e)}>
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
