// Recordings: Podcasts, Reports and Videos (BIC "Watch / Listen / Read" style).
// Each item has a link (YouTube, Spotify, SoundCloud, Apple Podcasts, Google Drive,
// an .mp3/.mp4/.pdf file, or any web page) and an optional cover photo.
import { CITIES } from './cities.js';
import { slugify } from './events.js';
import { youtubeId, mediaFor } from './media.js';
export { mediaFor };

export const TYPES = ['podcast', 'report', 'video'];
export const TYPE_LABELS = { podcast: 'Podcasts', report: 'Reports', video: 'Videos' };

const str = (v, max) => String(v ?? '').trim().slice(0, max);

export function cleanRecording(body) {
  const errors = {};
  const data = {
    type: str(body.type, 20),
    title: str(body.title, 200),
    number: str(body.number, 10),
    speakers: str(body.speakers, 300),
    category: str(body.category, 60),
    city: str(body.city, 30),
    date: str(body.date, 10),
    link: str(body.link, 1000),
    image: str(body.image, 500),
    description: str(body.description, 3000),
    published: body.published !== false && body.published !== 'false',
    // uploaded report: original file name + size (shown on the card, used as the download name)
    fileName: str(body.fileName, 150),
    fileSize: Number.isFinite(Number(body.fileSize)) ? Math.max(0, Math.round(Number(body.fileSize))) : 0,
  };
  if (!TYPES.includes(data.type)) errors.type = 'Choose Podcast, Report or Video';
  if (!data.title) errors.title = 'Title is required';
  if (data.number && !/^\d{1,6}$/.test(data.number)) errors.number = 'Numbers only (or leave empty)';
  if (data.city && !CITIES[data.city]) errors.city = 'Unknown city';
  if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) errors.date = 'Choose a valid date';
  const uploaded = /^\/files\/[a-f0-9-]{36}\.(pdf|docx?|pptx?)$/i.test(data.link);
  if (data.link && !uploaded && !/^https?:\/\/[^\s<>"]+\.[^\s<>"]+$/i.test(data.link)) errors.link = 'Paste a full link starting with https://';
  if (uploaded && data.type !== 'report') errors.link = 'Uploaded files are only for reports';
  if (!uploaded) {
    data.fileName = '';
    data.fileSize = 0;
  }
  if (data.image && !/^(https?:\/\/|\/uploads\/|\/samples\/|\/assets\/)/i.test(data.image)) errors.image = 'Invalid image';
  return { data, errors };
}

export function publicRecording(x) {
  const media = mediaFor(x.link);
  return {
    id: x._id,
    slug: x.slug || x._id,
    type: x.type,
    title: x.title,
    number: x.number || '',
    speakers: x.speakers || '',
    category: x.category || '',
    city: x.city || '',
    date: x.date || '',
    link: x.link || '',
    image: x.image || '',
    description: x.description || '',
    media,
    fileName: x.fileName || '',
    fileSize: x.fileSize || 0,
    sample: !!x.sample,
    source: 'recording',
  };
}

// Event videos (YouTube link added on an event) also show under Videos.
export function eventAsVideo(e) {
  const names = (e.speakers || []).map((s) => s.name).filter((n) => n && !n.startsWith('[')).join(', ');
  return {
    id: 'event-' + e._id,
    slug: e.slug,
    type: 'video',
    title: e.title,
    number: '',
    speakers: names || e.tagline || '',
    category: e.category || '',
    city: e.city || '',
    date: e.date || '',
    link: youtubeId(e.youtubeUrl || e.recordingUrl) ? `https://www.youtube.com/watch?v=${youtubeId(e.youtubeUrl || e.recordingUrl)}` : e.youtubeUrl || e.recordingUrl,
    image: e.image || '',
    description: names ? e.tagline || '' : '',
    media: mediaFor(e.youtubeUrl || e.recordingUrl),
    sample: !!e.sample,
    source: 'event',
    eventUrl: `/event/${e.slug}`,
  };
}

// newest first: by date, then number, then created time
export function sortRecordings(list) {
  return list.sort(
    (a, b) =>
      String(b.date || '').localeCompare(String(a.date || '')) ||
      (Number(b.number) || 0) - (Number(a.number) || 0) ||
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  );
}

export function uniqueSlugFor(list, title, exceptId) {
  const base = slugify(title) || 'recording';
  let slug = base;
  for (let i = 2; list.some((x) => x.slug === slug && x._id !== exceptId); i++) slug = `${base}-${i}`;
  return slug;
}

// ---------- samples (marked "Sample", removable in one click) ----------
const SAMPLE_NOTE = 'Sample item, added to show how this page works. Edit or delete it from the admin panel.';
const SAMPLES = [
  { type: 'podcast', number: '3', title: 'Energy for Livelihoods, in the Words of Those Who Use It', speakers: '[Guest name], with [Host name]', category: 'Livelihoods', city: 'bangalore', date: '2026-11-10', link: 'https://www.youtube.com/watch?v=NT-gVjZCct8', image: '/samples/space-green.webp' },
  { type: 'podcast', number: '2', title: 'Designing with End Users', speakers: '[Guest name], with [Host name]', category: 'Design', city: 'guwahati', date: '2026-10-22', link: 'https://www.youtube.com/watch?v=ps65pgdaw6U', image: '/samples/space-pink.webp' },
  { type: 'podcast', number: '1', title: 'Why Collective Wisdom Matters', speakers: '[Guest name], with [Host name]', category: 'Conversations', city: '', date: '2026-10-01', link: '', image: '/samples/space-yellow.webp' },
  { type: 'report', number: '', title: 'PCW Gathering 2026: Summary Report', speakers: 'PCW team', category: 'Event report', city: 'bangalore', date: '2026-11-01', link: '', image: '/samples/auditorium.webp' },
  { type: 'report', number: '', title: 'Women Entrepreneurs in the Northeast: Notes from the Field', speakers: '[Author name]', category: 'Field notes', city: 'guwahati', date: '2026-09-15', link: '', image: '/samples/women.webp' },
];

export async function seedRecordings(store) {
  const settings = store.collection('settings');
  const col = store.collection('recordings');
  if (await settings.findOne({ _id: 'recordingSamplesSeeded' })) return 0;
  const now = new Date().toISOString();
  if ((await col.count()) === 0) {
    const made = [];
    for (const s of SAMPLES) {
      const slug = uniqueSlugFor(made, s.title);
      made.push({ slug });
      await col.insertOne({ ...s, slug, description: SAMPLE_NOTE, published: true, sample: true, createdAt: now });
    }
  }
  await settings.updateOne({ _id: 'recordingSamplesSeeded' }, { at: now }, { upsert: true });
  return SAMPLES.length;
}
