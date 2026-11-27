import { useCallback, useEffect, useRef, useState } from 'react';
import SiteChrome from '../components/SiteChrome.jsx';
import Braid from '../components/Braid.jsx';
import EventCard from '../components/EventCard.jsx';
import Calendar from '../components/Calendar.jsx';
import RsvpModal from '../components/RsvpModal.jsx';
import CitySpace from '../components/CitySpace.jsx';
import Pager, { PER_PAGE } from '../components/Pager.jsx';
import { api } from '../api.js';
import { CITIES } from '../cities.js';
import { useSite } from '../site.js';
import { scrollToId } from '../motion.js';
import '../styles/pages.css';

const MENU = [
  ['upcoming', 'Upcoming events'],
  ['past', 'Past events'],
  ['calendar', 'Calendar'],
];
const scrollTo = (id) => scrollToId(id);

const canHover = () => window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;

function EventsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const timer = useRef(null);
  // desktop: opens on hover (like the top menu); touch: opens on tap
  const enter = () => {
    if (!canHover()) return;
    clearTimeout(timer.current);
    setOpen(true);
  };
  const leave = () => {
    if (!canHover()) return;
    timer.current = setTimeout(() => setOpen(false), 150);
  };
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
    scrollTo(id);
  };
  return (
    <div className="pcw-events-menu" ref={ref} onMouseEnter={enter} onMouseLeave={leave}>
      <button className="pcw-events-btn" aria-expanded={open} aria-haspopup="true" onClick={() => (canHover() ? setOpen(true) : setOpen(!open))}>
        Events
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="pcw-dropdown" role="menu">
          {MENU.map(([id, label]) => (
            <button key={id} role="menuitem" onClick={() => go(id)}>
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CityPage({ cityKey }) {
  const city = CITIES[cityKey];
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [cat, setCat] = useState('');
  const [modal, setModal] = useState(null); // {kind:'rsvp', event}
  const [upPage, setUpPage] = useState(1);
  const [pastPage, setPastPage] = useState(1);
  const [pastOrder, setPastOrder] = useState('new'); // new = newest first, old = oldest first
  const { bookingUrl } = useSite();

  const load = useCallback(() => {
    setError('');
    api(`/api/events?city=${cityKey}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [cityKey]);

  useEffect(() => {
    load();
  }, [city.name, load]);

  const close = useCallback(() => {
    setModal(null);
    load(); // refresh RSVP status (e.g. housefull)
  }, [load]);
  const byCat = (list) => (cat ? list.filter((e) => e.category === cat) : list);
  const when = (e) => `${e.date}T${e.startTime || '00:00'}`;
  const upcoming = data ? byCat(data.upcoming) : [];
  const past = data ? [...byCat(data.past)].sort((a, b) => (pastOrder === 'new' ? when(b).localeCompare(when(a)) : when(a).localeCompare(when(b)))) : [];
  const pageOf = (list, page) => list.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const goPage = (set, id) => (p) => {
    set(p);
    scrollToId(id);
  };
  const pickCat = (c) => {
    setCat(c);
    setUpPage(1);
    setPastPage(1);
  };

  // cards shown after a page / sort / category change appear straight away (no scroll-in animation)
  const firstShow = useRef(true);
  useEffect(() => {
    if (!data) return;
    if (firstShow.current) {
      firstShow.current = false;
      return;
    }
    const t = setTimeout(() => document.querySelectorAll('#upcoming .pcw-card, #past .pcw-card').forEach((c) => c.classList.add('is-in')), 0);
    return () => clearTimeout(t);
  }, [data, upPage, pastPage, pastOrder, cat]);

  // opened with a link like /space/bangalore#past (top menu): go there once the events are on the page
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (data && id) setTimeout(() => scrollToId(id), 350);
  }, [data]);
  const rsvp = (ev) => setModal({ kind: 'rsvp', event: ev });

  return (
    <SiteChrome active={cityKey}>
      <section className="pcw-city-hero">
        <nav className="pcw-subnav" aria-label={`${city.name} page`}>
          <EventsMenu />
          <a className="pcw-subnav-link" href="#the-space" onClick={(e) => (e.preventDefault(), scrollTo('the-space'))}>
            The space
          </a>
        </nav>
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
          {data.categories.length > 1 && (
            <div className="pcw-wrap pcw-filter-bar">
              <div className="pcw-chips" role="group" aria-label="Filter events by category">
                <button className={!cat ? 'is-on' : ''} aria-pressed={!cat} onClick={() => pickCat('')}>
                  All
                </button>
                {data.categories.map((c) => (
                  <button key={c} className={cat === c ? 'is-on' : ''} aria-pressed={cat === c} onClick={() => pickCat(c)}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <section className="pcw-wrap pcw-block" id="upcoming">
            <h2 className="pcw-h2">Upcoming events</h2>
            {upcoming.length ? (
              <>
                <div className="pcw-cards">
                  {pageOf(upcoming, upPage).map((e) => (
                    <EventCard key={e.id} event={e} onRsvp={rsvp} />
                  ))}
                </div>
                <Pager page={upPage} total={upcoming.length} onPage={goPage(setUpPage, 'upcoming')} label="Upcoming events" />
              </>
            ) : (
              <div className="pcw-empty">
                <p>{cat ? `No upcoming ${cat.toLowerCase()} right now.` : `No upcoming events in ${city.name} right now. New events will be listed here.`}</p>
              </div>
            )}
          </section>

          <section className="pcw-wrap pcw-block" id="past">
            <div className="pcw-block-head">
              <h2 className="pcw-h2">Past events</h2>
              {past.length > 1 && (
                <label className="pcw-sort">
                  <span>Sort by</span>
                  <select
                    value={pastOrder}
                    onChange={(e) => {
                      setPastOrder(e.target.value);
                      setPastPage(1);
                    }}
                  >
                    <option value="new">Newest to oldest</option>
                    <option value="old">Oldest to newest</option>
                  </select>
                </label>
              )}
            </div>
            {past.length ? (
              <>
                <div className="pcw-cards">
                  {pageOf(past, pastPage).map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
                <Pager page={pastPage} total={past.length} onPage={goPage(setPastPage, 'past')} label="Past events" />
              </>
            ) : (
              <div className="pcw-empty">
                <p>{cat ? `No past ${cat.toLowerCase()} yet.` : `Past events at the ${city.name} space will show up here.`}</p>
              </div>
            )}
          </section>

          <section className="pcw-wrap pcw-block" id="calendar">
            <h2 className="pcw-h2">Calendar</h2>
            <Calendar events={[...data.upcoming, ...data.past]} today={data.today} onPick={(e) => (window.location.href = `/event/${e.slug}`)} />
          </section>
        </>
      )}

      <CitySpace cityKey={cityKey} cityName={city.name} />

      <section className="pcw-wrap pcw-block" id="book">
        <h2 className="pcw-h2">Book the space</h2>
        <div className="pcw-book">
          <p>
            Host a workshop, a meeting or a community event at the PCW space in {city.name}. Fill in the booking form and the PCW team will get back to you.
          </p>
          <a className="pcw-pill pcw-pill-green" href={bookingUrl} target="_blank" rel="noopener noreferrer">
            Booking form <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>

      {modal?.kind === 'rsvp' && <RsvpModal event={modal.event} onClose={close} />}
    </SiteChrome>
  );
}
