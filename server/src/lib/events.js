import { youtubeId, mediaFor } from './media.js';
import { eventContentType } from './recordings.js';
// Event data helpers: cleaning admin input, public shape, YouTube links, slugs, calendar files.
import { CITIES } from './cities.js';

export const CATEGORIES = [
  'Talks',
  'Conversations',
  'Workshops',
  'Film & Screenings',
  'Panel Discussions',
  'Exhibitions',
  'Community',
  'Performing Arts',
  'Book Launch',
];
// open = our RSVP form, link = Google Form / any form link, closed, none = no registration
export const RSVP_MODES = ['open', 'link', 'closed', 'none'];

export { youtubeId, mediaFor } from './media.js';

export function slugify(s) {
  return (
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || 'event'
  );
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// documents attached to an event: uploaded file (/files/<uuid>.pdf …) or a share link (Google Drive etc.)
export const UPLOADED_DOC_RE = /^\/files\/[a-f0-9-]{36}\.(pdf|doc|docx|ppt|pptx)$/;
const LINK_RE = /^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i;
export const MAX_ATTACHMENTS = 10;
const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Clean + validate event data coming from the admin panel / import. Returns { data, errors }
export function cleanEvent(b) {
  const errors = {};
  const data = {
    city: str(b.city, 40).toLowerCase(),
    title: str(b.title, 160),
    tagline: str(b.tagline ?? b.summary, 300),
    category: str(b.category, 60),
    date: str(b.date, 10),
    startTime: str(b.startTime, 5),
    endTime: str(b.endTime, 5),
    venue: str(b.venue, 200),
    image: str(b.image, 500),
    description: str(b.description, 20000),
    youtubeUrl: str(b.youtubeUrl ?? b.recordingUrl, 1000),
    contentType: ['video', 'podcast'].includes(b.contentType) ? b.contentType : '',
    rsvp: RSVP_MODES.includes(b.rsvp) ? b.rsvp : b.rsvpOpen === false ? 'closed' : 'open',
    rsvpUrl: str(b.rsvpUrl, 1000),
    capacity: b.capacity === '' || b.capacity == null ? null : Number(b.capacity),
    published: b.published === undefined ? true : b.published === true || b.published === 'true',
    speakers: (Array.isArray(b.speakers) ? b.speakers : [])
      .map((s) => ({ name: str(s?.name, 120), role: str(s?.role, 200) }))
      .filter((s) => s.name)
      .slice(0, 12),
    // the event's report (Content type > Report): one PDF / Word / PowerPoint file or a share link
    report:
      b.report && str(b.report.url, 1000)
        ? { url: str(b.report.url, 1000), name: str(b.report.name, 150), size: Math.max(0, Math.round(Number(b.report.size) || 0)), title: str(b.report.title, 200) }
        : null,
    attachments: (Array.isArray(b.attachments) ? b.attachments : [])
      .map((a) => ({ url: str(a?.url, 1000), name: str(a?.name, 150), size: Math.max(0, Math.round(Number(a?.size) || 0)) }))
      .filter((a) => a.url),
  };
  if (data.report) {
    const r = data.report, uploaded = UPLOADED_DOC_RE.test(r.url);
    if (!uploaded && !LINK_RE.test(r.url)) errors.report = 'The report link must be a full link starting with https://';
    if (!uploaded) r.size = 0;
    if (!r.name) r.name = uploaded ? `Report.${r.url.split('.').pop()}` : 'Report';
  }
  if (data.attachments.length > MAX_ATTACHMENTS) errors.attachments = `Up to ${MAX_ATTACHMENTS} documents per event`;
  for (const a of data.attachments) {
    const uploaded = UPLOADED_DOC_RE.test(a.url);
    if (!uploaded && !LINK_RE.test(a.url)) errors.attachments = 'Each document link must be a full link starting with https://';
    if (!uploaded) a.size = 0;
    if (!a.name) a.name = uploaded ? `Document.${a.url.split('.').pop()}` : 'Document';
  }
  if (!CITIES[data.city]) errors.city = 'Choose a city';
  if (!data.title) errors.title = 'Title is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || Number.isNaN(Date.parse(data.date))) errors.date = 'Choose a date';
  if (data.startTime && !TIME_RE.test(data.startTime)) errors.startTime = 'Use HH:MM';
  if (data.endTime && !TIME_RE.test(data.endTime)) errors.endTime = 'Use HH:MM';
  if (data.startTime && data.endTime && data.endTime <= data.startTime) errors.endTime = 'End must be after start';
  // any video link: YouTube, Vimeo, Google Drive, .mp4, Facebook, a news site...
  if (data.youtubeUrl && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(data.youtubeUrl)) errors.youtubeUrl = 'Paste a full link starting with https://';
  if (data.image && !/^(https?:\/\/|\/uploads\/|\/samples\/)/i.test(data.image)) errors.image = 'Invalid image';
  if (data.rsvp === 'link') {
    if (!data.rsvpUrl) errors.rsvpUrl = 'Paste the form link (Google Form or any form)';
    else if (!/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(data.rsvpUrl)) errors.rsvpUrl = 'Paste a full link starting with https://';
  } else data.rsvpUrl = '';
  if (data.rsvp !== 'open') data.capacity = null; // seats only apply to our own RSVP form
  if (data.capacity !== null && (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 100000))
    errors.capacity = 'Enter a number or leave empty';
  return { data, errors };
}

export function rsvpStatus(e, today, taken = 0) {
  if (e.date && e.date < today) return 'over';
  const mode = e.rsvp || (e.rsvpOpen === false ? 'closed' : 'open');
  if (mode === 'none') return 'none';
  if (mode === 'closed') return 'closed';
  if (mode === 'link') return e.rsvpUrl ? 'link' : 'closed';
  if (e.capacity && taken >= e.capacity) return 'full';
  return 'open';
}

// Shape sent to the public website (works with old imported events too)
export function publicEvent(e, today, taken = 0) {
  const yt = youtubeId(e.youtubeUrl || e.recordingUrl);
  return {
    id: e._id,
    slug: e.slug || e._id,
    city: e.city,
    title: e.title,
    tagline: e.tagline || e.summary || '',
    category: e.category || '',
    date: e.date || '',
    startTime: e.startTime || '',
    endTime: e.endTime || '',
    timeText: e.time || '',
    venue: e.venue || '',
    image: e.image || '',
    description: e.description || '',
    speakers: e.speakers || [],
    youtubeId: yt,
    // the recording, whatever site it is on
    contentType: eventContentType(e),
    video: e.youtubeUrl || e.recordingUrl ? { ...mediaFor(e.youtubeUrl || e.recordingUrl), url: e.youtubeUrl || e.recordingUrl } : null,
    report: e.report?.url
      ? { url: e.report.url, name: e.report.name || 'Report', size: e.report.size || 0, title: e.report.title || e.title, kind: UPLOADED_DOC_RE.test(e.report.url) ? e.report.url.split('.').pop() : 'link' }
      : null,
    attachments: (e.attachments || []).map((a) => ({
      url: a.url,
      name: a.name || 'Document',
      size: a.size || 0,
      kind: UPLOADED_DOC_RE.test(a.url) ? a.url.split('.').pop() : 'link',
    })),
    rsvpStatus: rsvpStatus(e, today, taken),
    rsvpUrl: rsvpStatus(e, today, taken) === 'link' ? e.rsvpUrl : '',
    sample: !!e.sample,
  };
}

// .ics calendar file (Asia/Kolkata)
export function icsFor(e, siteUrl) {
  const d = (e.date || '').replace(/-/g, '');
  const t = (x) => (x || '').replace(':', '') + '00';
  const esc = (s) => String(s || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const timed = !!e.startTime;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PCW//Events//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${e._id}@pcw`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`,
    timed ? `DTSTART;TZID=Asia/Kolkata:${d}T${t(e.startTime)}` : `DTSTART;VALUE=DATE:${d}`,
    timed ? `DTEND;TZID=Asia/Kolkata:${d}T${t(e.endTime || e.startTime)}` : null,
    `SUMMARY:${esc(e.title)}`,
    `DESCRIPTION:${esc([e.tagline, `${siteUrl}/event/${e.slug}`].filter(Boolean).join('\n'))}`,
    `LOCATION:${esc(e.venue || `PCW Space, ${CITIES[e.city]?.name || ''}`)}`,
    `URL:${siteUrl}/event/${e.slug}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}
