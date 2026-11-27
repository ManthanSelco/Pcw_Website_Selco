import { useMemo, useState } from 'react';
import { formatDate, timeRange } from '../api.js';
import '../styles/calendar.css';

const WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// colour for each category label (same category = same colour all month)
const TONES = ['orange', 'yellow', 'pink', 'mint', 'cream'];
const who = (e) =>
  (e.speakers || [])
    .map((s) => s.name)
    .filter((n) => n && !n.startsWith('['))
    .join(', ');

// Month calendar (BIC style: one row per week, event titles in the days, details on hover)
// + the month's programme below it, grouped by category. On phones only the programme is shown.
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
    for (const list of Object.values(m)) list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
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
  // whole weeks, Monday to Sunday, including the days of the months before and after
  const start = new Date(y, mo - 1, 1 - ((first.getDay() + 6) % 7));
  const last = new Date(y, mo, 0);
  const end = new Date(y, mo - 1, last.getDate() + ((7 - last.getDay()) % 7));
  const weeks = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (!weeks.length || weeks[weeks.length - 1].length === 7) weeks.push([]);
    weeks[weeks.length - 1].push(iso(d));
  }

  const move = (d) => {
    const n = new Date(y, mo - 1 + d, 1);
    setYm(`${n.getFullYear()}-${pad(n.getMonth() + 1)}`);
    setSelected(null);
  };
  const thisMonth = today.slice(0, 7);

  const open = (e) => (ev) => {
    if (onPick && !ev.metaKey && !ev.ctrlKey) {
      ev.preventDefault();
      onPick(e);
    }
  };

  const monthEvents = events
    .filter((e) => e.date?.startsWith(ym))
    .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
  const shown = selected ? monthEvents.filter((e) => e.date === selected) : monthEvents;

  // programme: group by category, groups ordered by their first event
  const groups = [];
  for (const e of shown) {
    const c = e.category || 'Events';
    let g = groups.find((x) => x.name === c);
    if (!g) groups.push((g = { name: c, items: [] }));
    g.items.push(e);
  }

  return (
    <div className="pcw-cal-wrap">
      <div className="pcw-mcal-bar">
        <button className="pcw-mcal-arrow" onClick={() => move(-1)} aria-label="Previous month">
          ‹
        </button>
        <h3 aria-live="polite">{monthName}</h3>
        <button className="pcw-mcal-arrow" onClick={() => move(1)} aria-label="Next month">
          ›
        </button>
        {ym !== thisMonth && (
          <button className="pcw-mcal-today" onClick={() => (setYm(thisMonth), setSelected(null))}>
            This month
          </button>
        )}
      </div>

      <div className="pcw-mcal" role="table" aria-label={`Events in ${monthName}`}>
        <div className="pcw-mcal-row pcw-mcal-head" role="row">
          {WEEK.map((w) => (
            <div key={w} role="columnheader">
              <span className="pcw-mcal-wd-long">{w}</span>
              <span className="pcw-mcal-wd-short" aria-hidden="true">
                {w.slice(0, 3)}
              </span>
            </div>
          ))}
        </div>
        {weeks.map((week) => (
          <div className="pcw-mcal-row" role="row" key={week[0]}>
            {week.map((d, col) => {
              const list = byDay[d] || [];
              const cls = [
                'pcw-mcal-day',
                !d.startsWith(ym) && 'is-other',
                d < today && 'is-past',
                d === today && 'is-today',
                d === selected && 'is-selected',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <div key={d} className={cls} role="cell">
                  {list.length ? (
                    <button
                      className="pcw-mcal-num"
                      onClick={() => {
                        if (!d.startsWith(ym)) setYm(d.slice(0, 7));
                        setSelected(d === selected ? null : d);
                      }}
                      aria-pressed={d === selected}
                      aria-label={`${formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })}: show ${list.length === 1 ? 'this event' : `these ${list.length} events`} in the list below`}
                    >
                      {Number(d.slice(8))}
                    </button>
                  ) : (
                    <span className="pcw-mcal-num">{Number(d.slice(8))}</span>
                  )}
                  {list.length > 0 && (
                    <ul>
                      {list.map((e) => (
                        <li key={e.id} className={col >= 5 ? 'is-right' : ''}>
                          <a className={`pcw-mcal-ev tone-${tone[e.category || 'Events']}`} href={`/event/${e.slug}`} onClick={open(e)}>
                            {e.title}
                          </a>
                          <div className="pcw-mcal-pop" role="tooltip">
                            <b>{e.title}</b>
                            <span className="pcw-mcal-pop-date">
                              {formatDate(e.date, { weekday: 'short' })}, {formatDate(e.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                            {timeRange(e) && <span className="pcw-mcal-pop-time">{timeRange(e)}</span>}
                            {(who(e) || e.tagline) && <span className="pcw-mcal-pop-who">{who(e) || e.tagline}</span>}
                            {e.date < today && <em>Past event</em>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* the month's programme (on phones this is the calendar) */}
      <div className="pcw-prog" aria-live="polite">
        <div className="pcw-prog-headrow">
          <h3 className="pcw-prog-month">
            {selected ? formatDate(selected, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : `${monthName} programme`}
          </h3>
          {selected && (
            <button className="pcw-mcal-today" onClick={() => setSelected(null)}>
              Show the whole month
            </button>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="pcw-prog-none">{selected ? 'No events on this day.' : 'No events this month yet. Try the next month.'}</p>
        ) : (
          groups.map((g) => (
            <section key={g.name} className="pcw-prog-group" aria-label={g.name}>
              <h4 className={`pcw-prog-cat tone-${tone[g.name]}`}>{g.name}</h4>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id} className={e.date < today ? 'is-past' : ''}>
                    <a href={`/event/${e.slug}`} onClick={open(e)}>
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
