import { useEffect, useState } from 'react';
import SiteChrome from '../components/SiteChrome.jsx';
import Braid from '../components/Braid.jsx';
import EventCard from '../components/EventCard.jsx';
import { api } from '../api.js';
import { CITIES } from '../cities.js';
import '../styles/pages.css';

// Recordings = past events (any city) that have a recording link.
export default function RecordingsPage() {
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    document.title = 'Recordings | PCW';
    api('/api/events?recordings=1')
      .then((d) => setList(d.recordings))
      .catch((e) => setError(e.message));
  }, []);

  const shown = (list || []).filter((e) => !city || e.city === city);

  return (
    <SiteChrome active="recordings">
      <section className="pcw-city-hero">
        <Braid className="pcw-city-braid" />
        <div className="pcw-wrap pcw-hero-pad">
          <p className="pcw-eyebrow">PCW · WATCH AGAIN</p>
          <h1 className="pcw-city-title">Recordings</h1>
        </div>
      </section>
      <section className="pcw-wrap pcw-block">
        <div className="pcw-chips" role="group" aria-label="Filter by city">
          <button className={!city ? 'is-on' : ''} aria-pressed={!city} onClick={() => setCity('')}>
            All
          </button>
          {Object.entries(CITIES).map(([k, c]) => (
            <button key={k} className={city === k ? 'is-on' : ''} aria-pressed={city === k} onClick={() => setCity(k)}>
              {c.name}
            </button>
          ))}
        </div>
        {error && <p className="pcw-error">{error}</p>}
        {!list && !error && <div className="pcw-loading" aria-label="Loading" />}
        {list &&
          (shown.length ? (
            <div className="pcw-cards">
              {shown.map((e) => (
                <EventCard key={e.id} event={e} past showCity />
              ))}
            </div>
          ) : (
            <div className="pcw-empty">
              <p>Recordings of PCW events will appear here.</p>
            </div>
          ))}
      </section>
    </SiteChrome>
  );
}
