import { useMemo, useState } from 'react';
import { formatDate, timeRange } from '../api.js';

const WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n) => String(n).padStart(2, '0');

// Month calendar showing which days have events. Click a day to see its events.
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

  const [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1);
  const days = new Date(y, mo, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday first
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${pad(i + 1)}`)];
  while (cells.length % 7) cells.push(null);

  const move = (d) => {
    const n = new Date(y, mo - 1 + d, 1);
    setYm(`${n.getFullYear()}-${pad(n.getMonth() + 1)}`);
    setSelected(null);
  };
  const monthEvents = events.filter((e) => e.date?.startsWith(ym));
  const shown = selected ? byDay[selected] || [] : monthEvents;

  return (
    <div className="pcw-cal">
      <div className="pcw-cal-head">
        <button className="pcw-cal-nav" onClick={() => move(-1)} aria-label="Previous month">
          ‹
        </button>
        <h3>{first.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
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
              className={[
                'pcw-cal-day',
                byDay[d] && 'has-event',
                d < today && 'is-past',
                d === today && 'is-today',
                d === selected && 'is-selected',
              ]
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
      <div className="pcw-cal-list">
        <p className="pcw-cal-list-title">
          {selected ? formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long' }) : 'This month'}
        </p>
        {shown.length === 0 ? (
          <p className="pcw-cal-none">{selected ? 'No events on this day.' : 'No events this month.'}</p>
        ) : (
          <ul>
            {shown.map((e) => (
              <li key={e.id}>
                <button onClick={() => onPick(e)}>
                  <span className="pcw-cal-date">{formatDate(e.date, { day: 'numeric', month: 'short' })}</span>
                  <span className="pcw-cal-ev">{e.title}</span>
                  <span className="pcw-cal-time">{timeRange(e)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
