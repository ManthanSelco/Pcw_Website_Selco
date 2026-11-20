import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { CITIES, todayIST } from '../lib/cities.js';
import { validate } from '../lib/validate.js';

const formLimit = () => rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests. Please try again in a few minutes.' } });

// Only the fields the website needs
const publicEvent = (e) => ({
  id: e._id,
  city: e.city,
  title: e.title,
  category: e.category || '',
  summary: e.summary || '',
  date: e.date || '',
  time: e.time || '',
  venue: e.venue || '',
  image: e.image || '',
  recordingUrl: e.recordingUrl || '',
  rsvpOpen: e.rsvpOpen !== false,
});

export function eventRoutes(store) {
  const events = store.collection('events');
  const rsvps = store.collection('rsvps');
  const bookings = store.collection('bookings');
  const r = Router();

  // GET /api/events?city=bangalore  -> { city, today, upcoming[], past[] }
  // GET /api/events?recordings=1     -> past events that have a recording, all cities
  r.get('/events', async (req, res, next) => {
    try {
      const today = todayIST();
      let list = (await events.find({}, { sort: { date: 1 } })).filter((e) => e.published !== false);
      if (req.query.recordings) {
        list = list.filter((e) => e.recordingUrl).reverse();
        return res.json({ today, recordings: list.map(publicEvent) });
      }
      const city = String(req.query.city || '').toLowerCase();
      if (!CITIES[city]) return res.status(404).json({ error: 'Unknown city' });
      list = list.filter((e) => e.city === city);
      res.set('Cache-Control', 'no-cache');
      res.json({
        city,
        today,
        upcoming: list.filter((e) => !e.date || e.date >= today).map(publicEvent),
        past: list.filter((e) => e.date && e.date < today).reverse().map(publicEvent),
      });
    } catch (e) {
      next(e);
    }
  });

  r.post('/rsvp', formLimit(), async (req, res, next) => {
    try {
      const { data, errors, ok } = validate(req.body, {
        name: { required: true, max: 120 },
        email: { required: true, type: 'email', max: 160 },
        phone: { type: 'tel' },
        organisation: { max: 160 },
        people: { type: 'number', min: 1, maxValue: 50 },
      });
      const ev = req.body?.eventId ? await events.findOne({ _id: String(req.body.eventId) }) : null;
      if (!ev) errors.eventId = 'Event not found';
      else if (ev.date && ev.date < todayIST()) errors.eventId = 'This event is over';
      else if (ev.rsvpOpen === false) errors.eventId = 'RSVP is closed for this event';
      if (!ok || errors.eventId) return res.status(400).json({ error: errors.eventId || 'Please check the highlighted fields', errors });
      const dup = await rsvps.findOne({ eventId: ev._id, email: data.email });
      if (!dup) {
        await rsvps.insertOne({ ...data, people: data.people || 1, eventId: ev._id, eventTitle: ev.title, eventDate: ev.date, city: ev.city, createdAt: new Date().toISOString() });
      }
      res.json({ ok: true, message: `You're on the list for ${ev.title}. See you there!` });
    } catch (e) {
      next(e);
    }
  });

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
