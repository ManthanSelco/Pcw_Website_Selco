import { useCallback, useEffect, useState } from 'react';
import { scrollToId } from '../motion.js';
import SiteChrome from '../components/SiteChrome.jsx';
import EventCard from '../components/EventCard.jsx';
import RsvpModal from '../components/RsvpModal.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import DocViewer from '../components/DocViewer.jsx';
import { api, formatDate, timeRange } from '../api.js';
import { CITIES } from '../cities.js';

const DOC_LABEL = { pdf: 'PDF', doc: 'Word', docx: 'Word', ppt: 'PowerPoint', pptx: 'PowerPoint', link: 'Link' };
const fileSize = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n ? `${Math.max(1, Math.round(n / 1024))} KB` : '');

// the event's report (first, marked "Report") + documents attached to the event (agenda, slides…)
function Documents({ report, items }) {
  const [open, setOpen] = useState(null);
  const all = [...(report ? [{ ...report, name: report.title, isReport: true }] : []), ...items];
  return (
    <section className="pcw-wrap pcw-docs" id="documents" aria-labelledby="docs-title">
      <h2 className="pcw-h3" id="docs-title">
        Documents
      </h2>
      <ul className="pcw-docs-list">
        {all.map((a) => {
          return (
            <li key={a.url}>
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="pcw-doc"
                onClick={(ev) => {
                  if (ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
                  ev.preventDefault();
                  setOpen(a);
                }}
              >
                <span className={`pcw-doc-icon is-${a.kind}`} aria-hidden="true">
                  {a.kind === 'link' ? '↗' : a.kind.replace('x', '').toUpperCase()}
                </span>
                <span className="pcw-doc-text">
                  <b>{a.name}</b>
                  <small>{[a.isReport && 'Report', DOC_LABEL[a.kind] || 'File', fileSize(a.size)].filter(Boolean).join(' · ')}</small>
                </span>
                <span className="pcw-doc-action">View</span>
              </a>
            </li>
          );
        })}
      </ul>
      {open && <DocViewer doc={{ url: open.url, title: open.name, kicker: open.isReport ? 'Report' : 'Document' }} onClose={() => setOpen(null)} />}
    </section>
  );
}

// "Watch more": recordings of other events + videos from Recordings
function MoreVideos({ items }) {
  return (
    <section className="pcw-wrap pcw-block pcw-more-videos" aria-labelledby="more-videos-title">
      <div className="pcw-block-head">
        <h2 className="pcw-h2" id="more-videos-title">
          Watch more
        </h2>
        <a className="pcw-pill pcw-pill-outline" href="/recordings/videos">
          All videos <span aria-hidden="true">→</span>
        </a>
      </div>
      <div className="pcw-vids">
        {items.map((v) => (
          <a key={v.id} className="pcw-vid" href={v.href}>
            <span className="pcw-vid-photo">
              {v.image ? <img src={v.image} alt="" loading="lazy" onError={(ev) => (ev.currentTarget.style.visibility = 'hidden')} /> : null}
              <span className="pcw-vid-play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </span>
            </span>
            <span className="pcw-vid-body">
              <small>
                {[v.source === 'event' ? 'Event video' : 'Video', v.category, CITIES[v.city]?.name].filter(Boolean).join(' · ')}
                {v.sample && <span className="pcw-sample">Sample</span>}
              </small>
              <b>{v.title}</b>
              {v.date && <span className="pcw-vid-date">{formatDate(v.date)}</span>}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
import '../styles/pages.css';

const STATUS = {
  closed: 'RSVPs closed. Thank you for your interest.',
  full: 'This event is full. RSVPs closed.',
  over: 'This event has ended.',
};

function Share({ event }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href.split('#')[0];
  const text = `${event.title} · ${formatDate(event.date)}`;
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link', url);
    }
  }
  return (
    <>
      <button className="pcw-pill pcw-pill-outline" onClick={share}>
        {copied ? 'Link copied' : 'Share'}
      </button>
      <a className="pcw-pill pcw-pill-outline" href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`} target="_blank" rel="noopener noreferrer">
        WhatsApp
      </a>
    </>
  );
}

export default function EventPage({ slug }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [rsvp, setRsvp] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = useCallback(() => {
    api(`/api/events/${encodeURIComponent(slug)}`)
      .then((d) => {
        setData(d);
      })
      .catch((e) => setError(e.status === 404 ? 'notfound' : e.message));
  }, [slug]);
  useEffect(load, [load]);

  // jump to the video when the link ends with #watch
  useEffect(() => {
    if (data && window.location.hash === '#watch') setTimeout(() => scrollToId('watch'), 300);
  }, [data]);

  const e = data?.event;
  const city = e ? CITIES[e.city] : null;

  return (
    <SiteChrome active={e?.city || ''}>
      {error === 'notfound' && (
        <div className="pcw-wrap pcw-detail-missing">
          <h1 className="pcw-h2">Event not found</h1>
          <p>This event may have been removed.</p>
          <a className="pcw-pill pcw-pill-pink" href="/">
            Go to home page
          </a>
        </div>
      )}
      {error && error !== 'notfound' && (
        <div className="pcw-wrap pcw-error" style={{ paddingTop: 200 }}>
          <p>{error}</p>
        </div>
      )}
      {!data && !error && <div className="pcw-loading" style={{ paddingTop: 200 }} />}

      {e && (
        <>
          <section className="pcw-wrap pcw-detail-hero">
            <a className="pcw-back" href={`/space/${e.city}`}>
              ← {city?.name} events
            </a>
            <p className="pcw-eyebrow">
              {[e.category || 'Event', city?.label].filter(Boolean).join(' · ')}
              {e.sample && <span className="pcw-sample pcw-sample-dark">Sample</span>}
            </p>
            <h1 className="pcw-detail-title">{e.title}</h1>
            {e.tagline && <p className="pcw-detail-tagline">{e.tagline}</p>}

            <dl className="pcw-meta">
              <div>
                <dt>Date</dt>
                <dd>{formatDate(e.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd>
              </div>
              {timeRange(e) && (
                <div>
                  <dt>Time</dt>
                  <dd>{timeRange(e)}</dd>
                </div>
              )}
              <div>
                <dt>Venue</dt>
                <dd>{e.venue || `PCW Space, ${city?.name}`}</dd>
              </div>
            </dl>

            <div className="pcw-detail-actions">
              {e.rsvpStatus === 'open' && (
                <button className="pcw-pill pcw-pill-pink pcw-pill-lg" onClick={() => setRsvp(true)}>
                  RSVP
                </button>
              )}
              {e.rsvpStatus === 'link' && e.rsvpUrl && (
                <a className="pcw-pill pcw-pill-pink pcw-pill-lg" href={e.rsvpUrl} target="_blank" rel="noopener noreferrer">
                  Register <span aria-hidden="true">↗</span>
                </a>
              )}
              {STATUS[e.rsvpStatus] && <span className="pcw-detail-status">{STATUS[e.rsvpStatus]}</span>}
              {e.report && (
                <button className="pcw-pill pcw-pill-pink" onClick={() => setReportOpen(true)}>
                  Read the report
                </button>
              )}
              {e.rsvpStatus !== 'over' && (
                <a className="pcw-pill pcw-pill-outline" href={`/api/events/${encodeURIComponent(e.slug)}/ics`}>
                  Add to calendar
                </a>
              )}
              <Share event={e} />
            </div>
            {reportOpen && <DocViewer doc={{ url: e.report.url, title: e.report.title, kicker: 'Report' }} onClose={() => setReportOpen(false)} />}
          </section>

          {e.video && (
            <section className="pcw-wrap pcw-detail-video" id="watch">
              <h2 className="pcw-h3">{e.contentType === 'podcast' ? 'Listen' : 'Watch'}</h2>
              <VideoPlayer listen={e.contentType === 'podcast'} video={e.video} title={e.title} poster={e.image || (e.youtubeId ? `https://i.ytimg.com/vi/${e.youtubeId}/hqdefault.jpg` : '')} />
            </section>
          )}

          {!e.video && e.image && (
            <div className="pcw-wrap pcw-detail-image">
              <img src={e.image} alt={e.title} />
            </div>
          )}

          <section className="pcw-wrap pcw-detail-body">
            <div className="pcw-detail-text">
              <h2 className="pcw-h3">About the event</h2>
              {(e.description || e.tagline || 'Details will be shared soon.').split(/\n\s*\n/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
            {e.speakers.length > 0 && (
              <aside className="pcw-speakers">
                <h2 className="pcw-h3">Speakers</h2>
                <ul>
                  {e.speakers.map((s, i) => (
                    <li key={i}>
                      <span className="pcw-speaker-avatar" aria-hidden="true">
                        {s.name.replace(/[^A-Za-z]/g, '').slice(0, 1) || '•'}
                      </span>
                      <span>
                        <b>{s.name}</b>
                        {s.role && <small>{s.role}</small>}
                      </span>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </section>

          {(e.report || e.attachments?.length > 0) && <Documents report={e.report} items={e.attachments || []} />}

          {data.videos?.length > 0 && <MoreVideos items={data.videos} />}

          {data.related.length > 0 && (
            <section className="pcw-wrap pcw-block">
              <h2 className="pcw-h2">More at {city?.name}</h2>
              <div className="pcw-cards">
                {data.related.map((x) => (
                  <EventCard key={x.id} event={x} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {rsvp && e && (
        <RsvpModal
          event={e}
          onClose={() => {
            setRsvp(false);
            load();
          }}
        />
      )}
    </SiteChrome>
  );
}
