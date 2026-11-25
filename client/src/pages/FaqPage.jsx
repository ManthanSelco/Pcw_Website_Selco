import { useEffect, useState } from 'react';
import SiteChrome from '../components/SiteChrome.jsx';
import { api } from '../api.js';
import '../styles/pages.css';

// /faq: questions edited in Admin > FAQ. Links and emails in answers become clickable.
function linkify(text) {
  const parts = String(text).split(/(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.]+)/g);
  return parts.map((p, i) => {
    if (/^https?:\/\//.test(p))
      return (
        <a key={i} href={p} target="_blank" rel="noopener noreferrer">
          {p}
        </a>
      );
    if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(p))
      return (
        <a key={i} href={`mailto:${p}`}>
          {p}
        </a>
      );
    return p;
  });
}

export default function FaqPage() {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(0);
  useEffect(() => {
    api('/api/faq')
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, []);

  return (
    <SiteChrome active="" light>
      <section className="page-wrapper pcw-policy pcw-faq">
        <div className="w-layout-blockcontainer container w-container">
          <div className="div-block-12">
            <h1 className="heading-1 color_green">Frequently asked questions</h1>
          </div>
          <div className="full-content">
            {!items && <div className="pcw-loading pcw-loading-dark" aria-label="Loading" />}
            {items?.length === 0 && <p>Questions and answers will appear here soon.</p>}
            {items?.map((x, i) => (
              <div key={i} className={`pcw-faq-item${open === i ? ' is-open' : ''}`}>
                <h2>
                  <button type="button" aria-expanded={open === i} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
                    <span>{x.q}</span>
                    <span className="pcw-faq-icon" aria-hidden="true">
                      {open === i ? '−' : '+'}
                    </span>
                  </button>
                </h2>
                <div id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="pcw-faq-answer" hidden={open !== i}>
                  <p>{linkify(x.a)}</p>
                </div>
              </div>
            ))}
            {items?.length > 0 && (
              <p className="pcw-faq-more">
                Still have a question? <a href="/contact-us">Contact us</a>.
              </p>
            )}
          </div>
        </div>
      </section>
    </SiteChrome>
  );
}
