import { useMemo, useState } from 'react';
import { formatDate, timeRange } from '../api.js';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');
// colour for each category label (same category = same colour all month)
const TONES = ['orange', 'yellow', 'pink', 'mint', 'cream'];

// Month calendar + the month's programme below it (grouped by category, like a printed programme).
// Click a day to see only that day; click an event to open it.
export default function Calendar({ events, today, onPick }) {
  // start on this month; if nothing is left this month, jump to the month of the next event
  const [ym, setYm] = useState(() => {
    const now = today.slice(0, 7);
    if (events.some((e) => e.date?.startsWith(now) && e.date >= today)) return now;
    const next = events.filter((e) => e.date && e.date >= today).map((e) => e.date).sort()[0];
    return next ? next.slice(0, 7) : now;
  }); // "2026-11"
  const [selected, setSelected] = useState(null);

  const byDay = useMemo(() => {
    const m = {};
    for (const e of events) if (e.date) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  // one colour per category, stable for the whole list of events
  const tone = useMemo(() => {
    const cats = [...new Set(events.map((e) => e.category || 'Events'))].sort();
    return Object.fromEntries(cats.map((c, i) => [c, TONES[i % TONES.length]]));
  }, [events]);

  const [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const monthName = first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const days = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);

  const move = (d) => {
    const n = new Date(y, mo - 1 + d, 1);
    setYm(`${n.getFullYear()}-${pad(n.getMonth() + 1)}`);
    setSelected(null);
  };

  const monthEvents = events
    .filter((e) => e.date?.startsWith(ym))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
  const shown = selected ? monthEvents.filter((e) => e.date === selected) : monthEvents;

  // group by category, groups ordered by their first event
  const groups = [];
  for (const e of shown) {
    const c = e.category || 'Events';
    let g = groups.find((x) => x.name === c);
    if (!g) groups.push((g = { name: c, items: [] }));
    g.items.push(e);
  }
  const catCount = new Set(monthEvents.map((e) => e.category || 'Events')).size;

  return (
    <div className="pcw-cal-wrap">
      <div className="pcw-cal">
        <div className="pcw-cal-head">
          <button className="pcw-cal-nav" onClick={() => move(-1)} aria-label="Previous month">
            ‹
          </button>
          <h3>{monthName}</h3>
          <button className="pcw-cal-nav" onClick={() => move(1)} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="pcw-cal-grid" role="grid">
          {WEEK.map((w) => (
            <div key={w} className="pcw-cal-wd" role="columnheader">
              {w}
            </div>
          ))}
          {cells.map((d, i) =>
            d ? (
              <button
                key={d}
                role="gridcell"
                className={['pcw-cal-day', byDay[d] && 'has-event', d < today && 'is-past', d === today && 'is-today', d === selected && 'is-selected']
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => setSelected(d === selected ? null : d)}
                aria-label={`${formatDate(d)}${byDay[d] ? `, ${byDay[d].length} event${byDay[d].length > 1 ? 's' : ''}` : ''}`}
                aria-pressed={d === selected}
              >
                <span>{Number(d.slice(8))}</span>
                {byDay[d] && <i aria-hidden="true" />}
              </button>
            ) : (
              <div key={`e${i}`} className="pcw-cal-empty" />
            )
          )}
        </div>
        <aside className="pcw-cal-side" aria-label="Month summary">
          <p className="pcw-cal-side-kicker">{selected ? 'Selected day' : 'This month'}</p>
          <p className="pcw-cal-side-big">
            {selected ? formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : monthName}
          </p>
          <p className="pcw-cal-side-sum">
            {shown.length === 0
              ? selected
                ? 'No events on this day.'
                : 'No events this month.'
              : `${shown.length} event${shown.length > 1 ? 's' : ''}${!selected && catCount > 1 ? ` across ${catCount} themes` : ''}`}
          </p>
          {!selected && monthEvents.length > 0 && (
            <ul className="pcw-cal-legend">
              {[...new Set(monthEvents.map((e) => e.category || 'Events'))].map((c) => (
                <li key={c}>
                  <i className={`tone-${tone[c]}`} aria-hidden="true" />
                  {c}
                </li>
              ))}
            </ul>
          )}
          {selected && (
            <button className="pcw-cal-all" onClick={() => setSelected(null)}>
              Show the whole month
            </button>
          )}
        </aside>
      </div>

      {/* the month's programme */}
      <div className="pcw-prog" aria-live="polite">
        <h3 className="pcw-prog-month">{selected ? formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : monthName}</h3>
        {groups.length === 0 ? (
          <p className="pcw-prog-none">{selected ? 'No events on this day.' : 'No events this month yet. Try the next month.'}</p>
        ) : (
          groups.map((g) => (
            <section key={g.name} className="pcw-prog-group" aria-label={g.name}>
              <h4 className={`pcw-prog-cat tone-${tone[g.name]}`}>{g.name}</h4>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id} className={e.date < today ? 'is-past' : ''}>
                    <a
                      href={`/event/${e.slug}`}
                      onClick={(ev) => {
                        if (onPick && !ev.metaKey && !ev.ctrlKey) {
                          ev.preventDefault();
                          onPick(e);
                        }
                      }}
                    >
                      <span className="pcw-prog-date">
                        <b>{formatDate(e.date, { day: 'numeric', month: 'short' })}</b>
                        <small>{formatDate(e.date, { weekday: 'short' })}</small>
                      </span>
                      <span className="pcw-prog-main">
                        <b className="pcw-prog-title">{e.title}</b>
                        {e.tagline && <small className="pcw-prog-tag">{e.tagline}</small>}
                      </span>
                      <span className="pcw-prog-time">
                        {timeRange(e)}
                        {e.date < today && <em>Past</em>}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
