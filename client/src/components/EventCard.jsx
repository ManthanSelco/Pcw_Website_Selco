import { formatDate, timeRange, ytThumb } from '../api.js';
import { CITIES } from '../cities.js';

const STATUS_TEXT = { closed: 'RSVPs closed', full: 'Housefull' };

// Compact event card (BIC style): photo, category, title, one line about it.
// Upcoming: date + time and the RSVP / Register button. Past: date only, and Watch when there is a recording.
export default function EventCard({ event, onRsvp, showCity = false }) {
  const href = `/event/${event.slug}`;
  const past = event.rsvpStatus === 'over';
  const when = past
    ? formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' })
    : [formatDate(event.date, { weekday: 'short', day: 'numeric', month: 'short' }), timeRange(event)].filter(Boolean).join(' · ');
  const photo = event.image || (event.youtubeId ? ytThumb(event.youtubeId) : '');
  const hasVideo = !!event.video;
  return (
    <article className={`pcw-card${past ? ' is-past' : ''}`} id={`event-${event.id}`}>
      <a className="pcw-card-photo" href={href} tabIndex={-1} aria-hidden="true">
        {photo ? (
          <img src={photo} alt="" loading="lazy" onError={(ev) => (ev.currentTarget.style.visibility = 'hidden')} />
        ) : (
          <div className="pcw-card-photo-empty">
            <span className="pcw-tag-dark">{past ? 'PCW EVENT' : 'COMING UP'}</span>
          </div>
        )}
      </a>
      <div className="pcw-card-body">
        <p className="pcw-card-cat">
          {[showCity && CITIES[event.city]?.name, event.category].filter(Boolean).join(' · ') || 'Event'}
          {event.sample && <span className="pcw-sample">Sample</span>}
        </p>
        <h3 className="pcw-card-title">
          <a href={href}>
            {hasVideo && (
              <svg className="pcw-card-title-icon" viewBox="0 0 24 16" width="22" height="15" aria-label="Video">
                <rect x="0" y="1" width="16" height="14" rx="2" fill="currentColor" />
                <path d="M17 6l7-4v12l-7-4z" fill="currentColor" />
              </svg>
            )}
            {event.title}
          </a>
        </h3>
        {event.tagline && <p className="pcw-card-summary">{event.tagline}</p>}
        <div className="pcw-card-foot">
          <span className="pcw-card-when">{when}</span>
          {event.rsvpStatus === 'open' && onRsvp && (
            <button className="pcw-card-btn" onClick={() => onRsvp(event)} aria-label={`RSVP for ${event.title}`}>
              RSVP
            </button>
          )}
          {event.rsvpStatus === 'link' && event.rsvpUrl && (
            <a className="pcw-card-btn" href={event.rsvpUrl} target="_blank" rel="noopener noreferrer" aria-label={`Register for ${event.title} (opens a form in a new tab)`}>
              Register <span aria-hidden="true">↗</span>
            </a>
          )}
          {STATUS_TEXT[event.rsvpStatus] && <span className="pcw-card-status">{STATUS_TEXT[event.rsvpStatus]}</span>}
          {hasVideo && past && (
            <a className="pcw-card-btn" href={`${href}#watch`} aria-label={`Watch ${event.title}`}>
              Watch
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
