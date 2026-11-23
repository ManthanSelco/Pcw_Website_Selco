import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CITIES, todayIST } from '../lib/cities.js';
import { validate } from '../lib/validate.js';
import { publicEvent, rsvpStatus, icsFor } from '../lib/events.js';
import { getSpace } from '../lib/spaces.js';
import { getSite } from '../lib/site.js';
import { TYPES, TYPE_LABELS, publicRecording, eventAsVideo, sortRecordings } from '../lib/recordings.js';
import { youtubeId } from '../lib/events.js';

const formLimit = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests. Please try again in a few minutes.' },
  });

export function eventRoutes(store) {
  const events = store.collection('events');
  const rsvps = store.collection('rsvps');
  const bookings = store.collection('bookings');
  const r = Router();

  const published = async () => (await events.find({}, { sort: { date: 1 } })).filter((e) => e.published !== false);
  async function takenSeats() {
    const m = {};
    for (const x of await rsvps.find({})) m[x.eventId] = (m[x.eventId] || 0) + (x.people || 1);
    return m;
  }
  const findBySlug = async (slug) =>
    (await events.findOne({ slug })) || (await events.findOne({ _id: slug })) || (await events.find({})).find((e) => (e.oldSlugs || []).includes(slug)) || null;

  // GET /api/events?city=bangalore -> { city, today, upcoming[], past[], categories[] }
  r.get('/events', async (req, res, next) => {
    try {
      const today = todayIST();
      const city = String(req.query.city || '').toLowerCase();
      if (!CITIES[city]) return res.status(404).json({ error: 'Unknown city' });
      const taken = await takenSeats();
      const list = (await published()).filter((e) => e.city === city).map((e) => publicEvent(e, today, taken[e._id]));
      res.set('Cache-Control', 'no-cache');
      res.json({
        city,
        today,
        upcoming: list.filter((e) => !e.date || e.date >= today),
        past: list.filter((e) => e.date && e.date < today).reverse(),
        categories: [...new Set(list.map((e) => e.category).filter(Boolean))].sort(),
      });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/spaces/bangalore -> the "A Space to Connect in Person" section for that city
  r.get('/spaces/:city', async (req, res, next) => {
    try {
      const city = String(req.params.city).toLowerCase();
      if (!CITIES[city]) return res.status(404).json({ error: 'Unknown city' });
      res.set('Cache-Control', 'no-cache');
      res.json(await getSpace(store, city));
    } catch (e) {
      next(e);
    }
  });

  // GET /api/site -> { bookingUrl }
  r.get('/site', async (req, res, next) => {
    try {
      res.set('Cache-Control', 'no-cache');
      res.json(await getSite(store));
    } catch (e) {
      next(e);
    }
  });

  // GET /api/recordings?type=podcast|report|video -> { type, items[], categories[], counts{} }
  // Videos also include events that have a YouTube link.
  r.get('/recordings', async (req, res, next) => {
    try {
      const type = TYPES.includes(req.query.type) ? req.query.type : 'podcast';
      const all = (await store.collection('recordings').find({})).filter((x) => x.published !== false);
      const eventVideos = (await published()).filter((e) => youtubeId(e.youtubeUrl || e.recordingUrl));
      const counts = {};
      for (const t of TYPES) counts[t] = all.filter((x) => x.type === t).length + (t === 'video' ? eventVideos.length : 0);
      let items = sortRecordings(all.filter((x) => x.type === type)).map(publicRecording);
      if (type === 'video') items = sortRecordings([...items, ...eventVideos.map(eventAsVideo)]);
      res.set('Cache-Control', 'no-cache');
      res.json({ type, label: TYPE_LABELS[type], items, counts, categories: [...new Set(items.map((x) => x.category).filter(Boolean))].sort() });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/videos -> past/any events that have a YouTube video, newest first
  r.get('/videos', async (req, res, next) => {
    try {
      const today = todayIST();
      const list = (await published())
        .map((e) => publicEvent(e, today))
        .filter((e) => e.youtubeId)
        .reverse();
      res.json({ today, videos: list, categories: [...new Set(list.map((e) => e.category).filter(Boolean))].sort() });
    } catch (e) {
      next(e);
    }
  });

  // GET /api/events/:slug -> { event, related[] }
  r.get('/events/:slug', async (req, res, next) => {
    try {
      const e = await findBySlug(req.params.slug);
      if (!e || e.published === false) return res.status(404).json({ error: 'Event not found' });
      const today = todayIST();
      const taken = await takenSeats();
      const related = (await published())
        .filter((x) => x._id !== e._id && x.city === e.city && x.date >= today)
        .slice(0, 3)
        .map((x) => publicEvent(x, today, taken[x._id]));
      res.json({ today, event: publicEvent(e, today, taken[e._id]), related });
    } catch (err) {
      next(err);
    }
  });

  // GET /api/events/:slug/ics -> add to calendar
  r.get('/events/:slug/ics', async (req, res, next) => {
    try {
      const e = await findBySlug(req.params.slug);
      if (!e || e.published === false) return res.status(404).end();
      const site = `${req.protocol}://${req.get('host')}`;
      res.set('Content-Type', 'text/calendar; charset=utf-8');
      res.set('Content-Disposition', `attachment; filename="${e.slug || 'event'}.ics"`);
      res.send(icsFor({ ...e, slug: e.slug || e._id }, site));
    } catch (err) {
      next(err);
    }
  });

  r.post('/rsvp', formLimit(), async (req, res, next) => {
    try {
      const { data, errors, ok } = validate(req.body, {
        name: { required: true, max: 120 },
        email: { required: true, type: 'email', max: 160 },
        phone: { type: 'tel' },
        organisation: { max: 160 },
        people: { type: 'number', min: 1, maxValue: 20 },
      });
      const ev = req.body?.eventId ? await events.findOne({ _id: String(req.body.eventId) }) : null;
      // same email again for the same event: not counted twice, and the person is told so
      if (ok && ev && ev.published !== false && (await rsvps.findOne({ eventId: ev._id, email: data.email })))
        return res.json({ ok: true, already: true, message: `You're already registered for ${ev.title} with this email. See you there!` });
      if (!ev || ev.published === false) errors.eventId = 'Event not found';
      else {
        const taken = (await takenSeats())[ev._id] || 0;
        const st = rsvpStatus(ev, todayIST(), taken);
        if (st === 'over') errors.eventId = 'This event is over';
        else if (st === 'full') errors.eventId = 'Sorry, this event is full';
        else if (st === 'link') errors.eventId = 'Please register using the form link on the event page';
        else if (st !== 'open') errors.eventId = 'RSVPs are closed for this event';
        else if (ev.capacity && taken + (data.people || 1) > ev.capacity)
          errors.people = `Only ${ev.capacity - taken} seat${ev.capacity - taken === 1 ? '' : 's'} left`;
      }
      if (!ok || errors.eventId || errors.people)
        return res.status(400).json({ error: errors.eventId || errors.people || 'Please check the highlighted fields', errors });
      await rsvps.insertOne({
        ...data,
        people: data.people || 1,
        eventId: ev._id,
        eventTitle: ev.title,
        eventDate: ev.date,
        city: ev.city,
        createdAt: new Date().toISOString(),
      });
      res.json({ ok: true, message: `You're on the list for ${ev.title}. See you there!` });
    } catch (e) {
      next(e);
    }
  });

  // Space booking (the website shows "coming soon" for now; the API is ready)
  r.post('/bookings', formLimit(), async (req, res, next) => {
    try {
      const { data, errors, ok } = validate(req.body, {
        city: { required: true, options: Object.keys(CITIES) },
        name: { required: true, max: 120 },
        email: { required: true, type: 'email', max: 160 },
        phone: { required: true, type: 'tel' },
        organisation: { max: 160 },
        purpose: { required: true, options: ['Meet & co-create', 'Host an event', 'Workshop / training', 'Focus group', 'Other'] },
        date: { type: 'date' },
        people: { type: 'number', min: 1, maxValue: 500 },
        message: { max: 2000 },
      });
      if (data.date && data.date < todayIST()) errors.date = 'Please choose a future date';
      if (!ok || errors.date) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      await bookings.insertOne({ ...data, status: 'new', createdAt: new Date().toISOString() });
      res.json({ ok: true, message: 'Thank you! Our team will get back to you to confirm the booking.' });
    } catch (e) {
      next(e);
    }
  });

  return r;
}
