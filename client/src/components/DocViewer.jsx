import { useEffect, useState } from 'react';

// Shows a report / document right on the page (like the video player), with a button
// to open it in a new tab.
//   uploaded PDF            -> the browser's PDF viewer
//   uploaded Word / PPT     -> Microsoft's free online viewer (needs the live https site)
//   Google Drive / Docs     -> Google's preview
//   anything else           -> a card with "Open in new tab" (most sites don't allow being shown inside another site)
export function docViewUrl(url) {
  const u = String(url || '');
  // phones without a built-in PDF viewer (e.g. Chrome on Android) would only download it
  if (/^\/files\/[a-f0-9-]{36}\.pdf$/i.test(u)) return navigator.pdfViewerEnabled === false ? '' : `${u}#view=FitH`;
  if (/^\/files\/[a-f0-9-]{36}\.(docx?|pptx?)$/i.test(u)) {
    const { protocol, hostname, origin } = window.location;
    const isPublic = protocol === 'https:' && !/^(localhost|127\.|\d+\.\d+\.\d+\.\d+$)/.test(hostname);
    return isPublic ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(origin + u)}` : '';
  }
  let p;
  try {
    p = new URL(u);
  } catch {
    return '';
  }
  const host = p.hostname.replace(/^www\./, '');
  if (host === 'drive.google.com') {
    const id = (p.pathname.match(/\/file\/d\/([A-Za-z0-9_-]+)/) || [])[1] || p.searchParams.get('id');
    if (id) return `https://drive.google.com/file/d/${id}/preview`;
  }
  if (host === 'docs.google.com') {
    const m = p.pathname.match(/^\/(document|presentation|spreadsheets)\/d\/([A-Za-z0-9_-]+)/);
    if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  }
  return '';
}

export default function DocViewer({ doc, onClose }) {
  const view = docViewUrl(doc.url);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 6000); // never leave "Loading…" up for ever
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    document.body.classList.add('pcw-modal-open');
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.classList.remove('pcw-modal-open');
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const uploaded = doc.url.startsWith('/files/');
  return (
    <div className="pcw-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcw-doc-modal" role="dialog" aria-modal="true" aria-label={doc.title}>
        <header className="pcw-doc-modal-bar">
          <div className="pcw-doc-modal-title">
            {doc.kicker && <small>{doc.kicker}</small>}
            <b>{doc.title}</b>
          </div>
          <div className="pcw-doc-modal-actions">
            <a className="pcw-doc-modal-btn" href={doc.url} target="_blank" rel="noopener noreferrer">
              Open in new tab <span aria-hidden="true">↗</span>
            </a>
            {uploaded && (
              <a className="pcw-doc-modal-btn is-ghost" href={doc.url} download>
                Download
              </a>
            )}
            <button className="pcw-doc-modal-close" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>
        </header>
        {view ? (
          <div className="pcw-doc-frame">
            {!loaded && <p className="pcw-doc-loading">Loading the document…</p>}
            <iframe src={view} title={doc.title} onLoad={() => setLoaded(true)} allow="fullscreen" allowFullScreen />
          </div>
        ) : (
          <div className="pcw-doc-nopreview">
            <p>
              {uploaded
                ? 'This file can’t be shown inside the page on this device. Open it in a new tab or download it.'
                : 'This document is on another website. Open it in a new tab to read it.'}
            </p>
            <a className="pcw-doc-modal-btn" href={doc.url} target="_blank" rel="noopener noreferrer">
              Open in new tab <span aria-hidden="true">↗</span>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
