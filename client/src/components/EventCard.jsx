import { formatDate, timeRange, ytThumb } from '../api.js';
import { CITIES } from '../cities.js';

const STATUS_TEXT = { closed: 'RSVPs closed', full: 'Housefull · RSVPs closed' };

// Event card in the style of an events listing: photo, category, title, tagline, RSVP, date & time.
export default function EventCard({ event, onRsvp, showCity = false }) {
  const href = `/event/${event.slug}`;
  const when = [formatDate(event.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), timeRange(event)].filter(Boolean).join(' · ');
  const photo = event.image || (event.youtubeId ? ytThumb(event.youtubeId) : '');
  return (
    <article className="pcw-card" id={`event-${event.id}`}>
      <a className="pcw-card-photo" href={href} tabIndex={-1} aria-hidden="true">
        {photo ? (
          <img src={photo} alt="" loading="lazy" onError={(ev) => (ev.currentTarget.style.visibility = 'hidden')} />
        ) : (
          <div className="pcw-card-photo-empty">
            <span className="pcw-tag-dark">{event.rsvpStatus === 'over' ? 'PCW EVENT' : 'COMING UP'}</span>
            <span>{event.venue || 'PCW Space'}</span>
          </div>
        )}
        {event.youtubeId && (
          <span className="pcw-card-play">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M8 5v14l11-7z" fill="currentColor" />
            </svg>
            Video
          </span>
        )}
      </a>
      <div className="pcw-card-body">
        <p className="pcw-card-cat">
          {[showCity && CITIES[event.city]?.name, event.category].filter(Boolean).join(' · ') || 'Event'}
          {event.sample && <span className="pcw-sample">Sample</span>}
        </p>
        <h3 className="pcw-card-title">
          <a href={href}>{event.title}</a>
        </h3>
        {event.tagline && <p className="pcw-card-summary">{event.tagline}</p>}
        <p className="pcw-card-when">{when}</p>
        <div className="pcw-card-actions">
          {event.rsvpStatus === 'open' && onRsvp && (
            <button className="pcw-pill pcw-pill-pink" onClick={() => onRsvp(event)} aria-label={`RSVP for ${event.title}`}>
              RSVP
            </button>
          )}
          {event.rsvpStatus === 'link' && event.rsvpUrl && (
            <a className="pcw-pill pcw-pill-pink" href={event.rsvpUrl} target="_blank" rel="noopener noreferrer" aria-label={`Register for ${event.title} (opens a form in a new tab)`}>
              Register <span aria-hidden="true">↗</span>
            </a>
          )}
          {STATUS_TEXT[event.rsvpStatus] && <span className="pcw-card-status">{STATUS_TEXT[event.rsvpStatus]}</span>}
          {event.youtubeId && event.rsvpStatus === 'over' && (
            <a className="pcw-pill pcw-pill-pink" href={`${href}#watch`}>
              Watch
            </a>
          )}
          <a className="pcw-card-more" href={href}>
            Details <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </article>
  );
}
