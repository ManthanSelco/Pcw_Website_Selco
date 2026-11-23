import { useCallback, useEffect, useMemo, useState } from 'react';
import SiteChrome from '../components/SiteChrome.jsx';
import { api, formatDate, ytThumb } from '../api.js';
import { CITIES } from '../cities.js';
import '../styles/pages.css';

// Recordings (like BIC "Watch / Listen / Read"): Podcasts, Reports, Videos.
// Everything is added from Admin > Recordings. Players open right here on the website.
const TABS = [
  { key: 'podcasts', type: 'podcast', label: 'Podcasts', unit: 'Episodes', one: 'Podcast' },
  { key: 'reports', type: 'report', label: 'Reports', unit: 'Reports', one: 'Report' },
  { key: 'videos', type: 'video', label: 'Videos', unit: 'Videos', one: 'Video' },
];
const PAGE = 12;
const PLAYABLE = ['youtube', 'spotify', 'soundcloud', 'apple', 'drive', 'audio', 'video'];

function tabFromPath() {
  const k = window.location.pathname.split('/')[2];
  return TABS.find((t) => t.key === k) || TABS[0];
}

const actionLabel = (item) => {
  const k = item.media?.kind;
  if (!item.link || k === 'none') return '';
  if (item.type === 'report') return k === 'drive' ? 'Read report' : 'Open report';
  if (k === 'youtube' || k === 'video') return 'Watch';
  if (PLAYABLE.includes(k)) return 'Listen';
  return 'Open link';
};

function cover(item) {
  if (item.image) return item.image;
  if (item.media?.kind === 'youtube') return ytThumb(item.media.youtubeId);
  return '';
}

function Player({ item }) {
  const m = item.media || {};
  if (m.kind === 'youtube')
    return (
      <div className="pcw-yt">
        <iframe
          src={`${m.embed}?autoplay=1&rel=0&modestbranding=1`}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  if (m.kind === 'audio') return <audio className="pcw-rec-audio" src={m.src} controls autoPlay preload="none" />;
  if (m.kind === 'video') return <video className="pcw-rec-video" src={m.src} controls autoPlay playsInline />;
  const audioOnly = ['spotify', 'soundcloud', 'apple'].includes(m.kind);
  return (
    <div className={audioOnly ? `pcw-rec-embed is-audio${m.tall ? ' is-tall' : ''}` : 'pcw-yt'}>
      <iframe src={m.embed} title={item.title} allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" allowFullScreen loading="lazy" />
    </div>
  );
}

function PlayerModal({ item, tab, onClose }) {
  useEffect(() => {
    document.body.classList.add('pcw-modal-open');
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => {
      document.body.classList.remove('pcw-modal-open');
      window.removeEventListener('keydown', esc);
    };
  }, [onClose]);
  const meta = [item.number && `#${item.number}`, CITIES[item.city]?.name, item.category, formatDate(item.date)].filter(Boolean).join(' · ');
  return (
    <div className="pcw-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pcw-video-modal pcw-rec-modal" role="dialog" aria-modal="true" aria-label={item.title}>
        <button className="pcw-modal-close" onClick={onClose} aria-label="Close player">
          ×
        </button>
        {['spotify', 'soundcloud', 'apple'].includes(item.media?.kind) && <p className="pcw-rec-modal-kicker">{tab.one}</p>}
        <Player item={item} />
        <div className="pcw-video-modal-info">
          {meta && <p className="pcw-card-cat">{meta}</p>}
          <h2>{item.title}</h2>
          {item.speakers && <p className="pcw-rec-speakers">{item.speakers}</p>}
          {item.description && <p className="pcw-rec-desc">{item.description}</p>}
          <div className="pcw-rec-modal-links">
            {item.eventUrl && (
              <a className="pcw-card-more" href={item.eventUrl}>
                Event details <span aria-hidden="true">→</span>
              </a>
            )}
            <a className="pcw-card-more" href={item.link} target="_blank" rel="noopener noreferrer">
              Open on {sourceName(item)} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function sourceName(item) {
  return (
    { youtube: 'YouTube', spotify: 'Spotify', soundcloud: 'SoundCloud', apple: 'Apple Podcasts', drive: 'Google Drive' }[item.media?.kind] || 'the original site'
  );
}

function Card({ item, tab, onPlay }) {
  const [img, setImg] = useState(cover(item));
  const label = actionLabel(item);
  const playable = PLAYABLE.includes(item.media?.kind);
  const open = (e) => {
    if (!item.link) return e.preventDefault();
    if (playable) {
      e.preventDefault();
      onPlay(item);
    }
  };
  const linkProps = item.link
    ? { href: item.link, target: playable ? undefined : '_blank', rel: playable ? undefined : 'noopener noreferrer', onClick: open }
    : null;
  const Wrap = linkProps ? 'a' : 'div';
  return (
    <article className="pcw-rec-card">
      <Wrap className="pcw-rec-cover" {...(linkProps || {})} aria-label={linkProps && label ? `${label}: ${item.title}` : undefined}>
        {img ? (
          <img
            src={img}
            alt=""
            loading="lazy"
            onError={() => setImg(img !== item.image && item.image ? item.image : '')}
          />
        ) : (
          <span className="pcw-rec-placeholder">
            <span className="pcw-rec-badge">{tab.one}</span>
            <span>PCW · Platform for Collective Wisdom</span>
          </span>
        )}
        {playable && (
          <span className="pcw-rec-play" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <circle cx="24" cy="24" r="24" fill="#ff5c39" />
              <path d="M19 15l15 9-15 9z" fill="#feffe8" />
            </svg>
          </span>
        )}
      </Wrap>
      <div className="pcw-rec-body">
        <p className="pcw-rec-eyebrow">
          {[item.category || tab.one, CITIES[item.city]?.name].filter(Boolean).join(' · ')}
          {item.sample && <span className="pcw-sample">Sample</span>}
        </p>
        <h3 className="pcw-rec-title">
          {item.number && <span className="pcw-rec-num">{item.number}.</span>} {item.title}
        </h3>
        {item.speakers && <p className="pcw-rec-line">{item.speakers}</p>}
        <div className="pcw-rec-foot">
          {item.date && <span className="pcw-rec-date">{formatDate(item.date)}</span>}
          {label ? (
            <a className="pcw-rec-action" {...linkProps}>
              {label} <span aria-hidden="true">{playable ? '→' : '↗'}</span>
            </a>
          ) : (
            <span className="pcw-rec-soon">Link coming soon</span>
          )}
        </div>
      </div>
    </article>
  );
}

export default function RecordingsPage() {
  const [tab, setTab] = useState(tabFromPath);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [city, setCity] = useState('');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [shownCount, setShownCount] = useState(PAGE);
  const [playing, setPlaying] = useState(null);

  const load = useCallback(() => {
    setData(null);
    setError('');
    api(`/api/recordings?type=${tab.type}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [tab.type]);

  useEffect(() => {
    document.title = `PCW ${tab.label} | Platform for Collective Wisdom`;
    const canon = document.querySelector('link[rel="canonical"]');
    if (canon) canon.href = `${window.location.origin}/recordings/${tab.key}`;
    load();
    setCat('');
    setShownCount(PAGE);
  }, [tab, load]);

  useEffect(() => {
    const on = () => setTab(tabFromPath());
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);

  const pick = (t) => (e) => {
    e.preventDefault();
    if (t.key === tab.key) return;
    window.history.pushState({}, '', `/recordings/${t.key}`);
    setTab(t);
  };
  const close = useCallback(() => setPlaying(null), []);

  const s = q.trim().toLowerCase();
  const list = useMemo(
    () =>
      (data?.items || []).filter(
        (x) =>
          (!city || x.city === city) &&
          (!cat || x.category === cat) &&
          (!s || `${x.number} ${x.title} ${x.speakers} ${x.category} ${x.description}`.toLowerCase().includes(s))
      ),
    [data, city, cat, s]
  );
  const total = data?.counts?.[tab.type] ?? 0;

  return (
    <SiteChrome active="recordings" light>
      <div className="pcw-rec-page">
        <nav className="pcw-subnav pcw-rec-tabs" aria-label="Recordings">
          {TABS.map((t) => (
            <a key={t.key} href={`/recordings/${t.key}`} className={`pcw-subnav-link${t.key === tab.key ? ' is-on' : ''}`} aria-current={t.key === tab.key ? 'page' : undefined} onClick={pick(t)}>
              {t.label}
            </a>
          ))}
        </nav>

        <div className="pcw-wrap">
          <header className="pcw-rec-head">
            <h1>{tab.label}</h1>
            <p className="pcw-rec-count">
              <span>[{data ? total : '–'}]</span> {tab.unit}
            </p>
          </header>

          <div className="pcw-rec-tools">
            <div className="pcw-chips pcw-chips-light" role="group" aria-label="Filter by city">
              <button className={!city ? 'is-on' : ''} aria-pressed={!city} onClick={() => setCity('')}>
                All
              </button>
              {Object.entries(CITIES).map(([k, c]) => (
                <button key={k} className={city === k ? 'is-on' : ''} aria-pressed={city === k} onClick={() => setCity(k)}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="pcw-rec-search">
              {data?.categories?.length > 0 && (
                <>
                  <label className="pcw-sr" htmlFor="rec-cat">
                    Category
                  </label>
                  <select id="rec-cat" value={cat} onChange={(e) => setCat(e.target.value)}>
                    <option value="">All categories</option>
                    {data.categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </>
              )}
              <label className="pcw-sr" htmlFor="rec-q">
                Search {tab.label.toLowerCase()}
              </label>
              <input id="rec-q" type="search" placeholder={`Search ${tab.label.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>

          {error && (
            <div className="pcw-rec-empty">
              <p>{error}</p>
              <button className="pcw-pill pcw-pill-green" onClick={load}>
                Try again
              </button>
            </div>
          )}
          {!data && !error && <div className="pcw-loading pcw-loading-dark" aria-label="Loading" />}
          {data &&
            (list.length ? (
              <>
                <div className="pcw-rec-grid">
                  {list.slice(0, shownCount).map((x) => (
                    <Card key={x.id} item={x} tab={tab} onPlay={setPlaying} />
                  ))}
                </div>
                {list.length > shownCount && (
                  <div className="pcw-rec-more">
                    <button className="pcw-pill pcw-pill-green" onClick={() => setShownCount((n) => n + PAGE)}>
                      Show more {tab.label.toLowerCase()}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="pcw-rec-empty">
                <p>{data.items.length ? `No ${tab.label.toLowerCase()} match your search.` : `${tab.label} from PCW will appear here soon.`}</p>
              </div>
            ))}
        </div>
      </div>
      {playing && <PlayerModal item={playing} tab={tab} onClose={close} />}
    </SiteChrome>
  );
}
