import { useCallback, useEffect, useState } from 'react';
import { scrollToId } from '../motion.js';
import SiteChrome from '../components/SiteChrome.jsx';
import EventCard from '../components/EventCard.jsx';
import RsvpModal from '../components/RsvpModal.jsx';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { api, formatDate, timeRange } from '../api.js';
import { CITIES } from '../cities.js';
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
              {e.rsvpStatus !== 'over' && (
                <a className="pcw-pill pcw-pill-outline" href={`/api/events/${encodeURIComponent(e.slug)}/ics`}>
                  Add to calendar
                </a>
              )}
              <Share event={e} />
            </div>
          </section>

          {e.video && (
            <section className="pcw-wrap pcw-detail-video" id="watch">
              <h2 className="pcw-h3">Watch</h2>
              <VideoPlayer video={e.video} title={e.title} poster={e.image || (e.youtubeId ? `https://i.ytimg.com/vi/${e.youtubeId}/hqdefault.jpg` : '')} />
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
