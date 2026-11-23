import { formatDate } from '../api.js';

// One event card (upcoming or past), styled like the PCW design reference.
export default function EventCard({ event, past = false, onRsvp, showCity = false }) {
  const when = [formatDate(event.date), event.time].filter(Boolean).join(' · ');
  return (
    <article className="pcw-card" id={`event-${event.id}`}>
      <div className="pcw-card-photo">
        {event.image ? (
          <img src={event.image} alt={event.title} loading="lazy" />
        ) : (
          <div className="pcw-card-photo-empty">
            <span className="pcw-tag-dark">{past ? 'PCW EVENT' : 'COMING UP'}</span>
            <span>{event.venue || 'PCW Space'}</span>
          </div>
        )}
      </div>
      <div className="pcw-card-body">
        {(event.category || showCity) && (
          <p className="pcw-card-cat">{[showCity && event.city, event.category].filter(Boolean).join(' · ')}</p>
        )}
        <h3 className="pcw-card-title">{event.title}</h3>
        {event.summary && <p className="pcw-card-summary">{event.summary}</p>}
        <p className="pcw-card-when">{when}</p>
        {!past && event.rsvpOpen && (
          <button className="pcw-pill pcw-pill-pink" onClick={() => onRsvp(event)} aria-label={`RSVP for ${event.title}`}>
            RSVP
          </button>
        )}
        {past && event.recordingUrl && (
          <a className="pcw-pill pcw-pill-pink" href={event.recordingUrl} target="_blank" rel="noopener noreferrer">
            Watch recording
          </a>
        )}
      </div>
    </article>
  );
}
