import { useCallback, useEffect, useRef, useState } from 'react';
import SiteChrome from '../components/SiteChrome.jsx';
import Braid from '../components/Braid.jsx';
import EventCard from '../components/EventCard.jsx';
import Calendar from '../components/Calendar.jsx';
import FormModal from '../components/FormModal.jsx';
import { api, formatDate } from '../api.js';
import { CITIES } from '../cities.js';
import '../styles/pages.css';

const RSVP_FIELDS = [
  { name: 'name', label: 'Your name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel' },
  { name: 'organisation', label: 'Organisation' },
  { name: 'people', label: 'How many people?', type: 'number', min: 1, max: 50 },
];

const BOOK_FIELDS = [
  { name: 'name', label: 'Your name', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'phone', label: 'Phone', type: 'tel', required: true },
  { name: 'organisation', label: 'Organisation' },
  { name: 'purpose', label: 'What is it for?', type: 'select', required: true, options: ['Meet & co-create', 'Host an event', 'Workshop / training', 'Focus group', 'Other'] },
  { name: 'date', label: 'Preferred date', type: 'date' },
  { name: 'people', label: 'Number of people', type: 'number', min: 1, max: 500 },
  { name: 'message', label: 'Tell us more', type: 'textarea' },
];

function ComingSoon({ cityName, onClose }) {
  const btn = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    btn.current?.focus();
    document.body.classList.add('pcw-modal-open');
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.classList.remove('pcw-modal-open');
      window.removeEventListener('keydown', esc);
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="pcw-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcw-modal pcw-soon" role="dialog" aria-modal="true" aria-labelledby="pcw-soon-title">
        <span className="pcw-tag-dark">COMING SOON</span>
        <h2 id="pcw-soon-title">Booking the {cityName} space</h2>
        <p className="pcw-modal-intro">Space booking is opening soon. Check back here shortly.</p>
        <button ref={btn} className="pcw-pill pcw-pill-pink" onClick={onClose}>
          Okay
        </button>
      </div>
    </div>
  );
}

function EventsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const out = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', out);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const go = (id) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  return (
    <div className="pcw-events-menu" ref={ref}>
      <button className="pcw-events-btn" aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}>
        Events
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="pcw-dropdown" role="menu">
          <button role="menuitem" onClick={() => go('upcoming')}>
            Upcoming events
          </button>
          <button role="menuitem" onClick={() => go('past')}>
            Past events
          </button>
          <button role="menuitem" onClick={() => go('calendar')}>
            Calendar
          </button>
        </div>
      )}
    </div>
  );
}

export default function CityPage({ cityKey }) {
  const city = CITIES[cityKey];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null); // {kind:'rsvp', event} | {kind:'book'}

  const load = useCallback(() => {
    setError('');
    api(`/api/events?city=${cityKey}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [cityKey]);

  useEffect(() => {
    document.title = `${city.name} | PCW Space`;
    load();
  }, [city.name, load]);

  const close = useCallback(() => setModal(null), []);
  const pick = (e) => {
    const el = document.getElementById(`event-${e.id}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el?.classList.add('is-flash');
    setTimeout(() => el?.classList.remove('is-flash'), 1600);
  };

  return (
    <SiteChrome active={cityKey}>
      <section className="pcw-city-hero">
        <div className="pcw-subnav">
          <EventsMenu />
          <button className="pcw-pill pcw-pill-green" onClick={() => setModal({ kind: 'book' })}>
            Book the space
          </button>
        </div>
        <Braid className="pcw-city-braid" />
        <div className="pcw-wrap">
          <p className="pcw-eyebrow">PCW SPACE · {city.label}</p>
          <h1 className="pcw-city-title">{city.name}</h1>
        </div>
      </section>

      {error && (
        <div className="pcw-wrap pcw-error">
          <p>{error}</p>
          <button className="pcw-pill pcw-pill-pink" onClick={load}>
            Try again
          </button>
        </div>
      )}
      {!data && !error && <div className="pcw-loading" aria-label="Loading events" />}

      {data && (
        <>
          <section className="pcw-wrap pcw-block" id="upcoming">
            <h2 className="pcw-h2">Upcoming events</h2>
            {data.upcoming.length ? (
              <div className="pcw-cards">
                {data.upcoming.map((e) => (
                  <EventCard key={e.id} event={e} onRsvp={(ev) => setModal({ kind: 'rsvp', event: ev })} />
                ))}
              </div>
            ) : (
              <div className="pcw-empty">
                <p>No upcoming events in {city.name} right now. New events will be listed here.</p>
              </div>
            )}
          </section>

          <section className="pcw-wrap pcw-block" id="past">
            <h2 className="pcw-h2">Past events</h2>
            {data.past.length ? (
              <div className="pcw-cards">
                {data.past.map((e) => (
                  <EventCard key={e.id} event={e} past />
                ))}
              </div>
            ) : (
              <div className="pcw-empty">
                <p>Past events at the {city.name} space will show up here.</p>
              </div>
            )}
          </section>

          <section className="pcw-wrap pcw-block" id="calendar">
            <h2 className="pcw-h2">Calendar</h2>
            <Calendar events={[...data.upcoming, ...data.past]} today={data.today} onPick={pick} />
          </section>
        </>
      )}

      {modal?.kind === 'rsvp' && (
        <FormModal
          title={`RSVP: ${modal.event.title}`}
          intro={[formatDate(modal.event.date), modal.event.time, modal.event.venue].filter(Boolean).join(' · ')}
          fields={RSVP_FIELDS}
          submitLabel="Confirm RSVP"
          endpoint="/api/rsvp"
          extra={{ eventId: modal.event.id }}
          onClose={close}
        />
      )}
      {/* Booking is "coming soon" for now. To switch the booking form back on, show
          <FormModal title=... fields={BOOK_FIELDS} endpoint="/api/bookings" extra={{ city: cityKey }} />
          here instead (the backend for it is already in place). */}
      {modal?.kind === 'book' && <ComingSoon cityName={city.name} onClose={close} />}
    </SiteChrome>
  );
}
