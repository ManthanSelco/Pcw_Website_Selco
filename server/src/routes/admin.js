import crypto from 'node:crypto';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import sharp from 'sharp';
import { todayIST, CITIES } from '../lib/cities.js';
import { cleanEvent, slugify, youtubeId, CATEGORIES, RSVP_MODES } from '../lib/events.js';
import { toCsv } from '../lib/csv.js';
import { getSpace, cleanSpace, spaceCities } from '../lib/spaces.js';
import { TYPES, TYPE_LABELS, cleanRecording, mediaFor, uniqueSlugFor, sortRecordings } from '../lib/recordings.js';
import { getSite, cleanSite } from '../lib/site.js';
import { getFaq, cleanFaq, DEFAULT_FAQ } from '../lib/faq.js';
import { docNameFromUrl } from '../lib/storage.js';

const BOOKING_STATUSES = ['new', 'contacted', 'confirmed', 'declined'];

export function adminRoutes(store, auth, { storage }) {
  const events = store.collection('events');
  const rsvps = store.collection('rsvps');
  const newsletter = store.collection('newsletter');
  const bookings = store.collection('bookings');
  const recordings = store.collection('recordings');
  const r = Router();
  const h = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  // ---------- login ----------
  // 10 wrong passwords per 15 minutes per IP; successful logins don't count
  r.post(
    '/login',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many wrong attempts. Try again in 15 minutes.' } }),
    h(auth.login)
  );
  r.post('/logout', auth.logout);
  r.use(auth.requireAdmin); // everything below needs login
  r.get('/me', (req, res) => res.json({ username: req.admin.username, db: store.kind }));
  r.post('/password', h(auth.changePassword));

  // ---------- dashboard ----------
  r.get(
    '/stats',
    h(async (req, res) => {
      const today = todayIST();
      const all = await events.find({});
      const latest = await rsvps.find({}, { sort: { createdAt: -1 }, limit: 8 });
      res.json({
        upcoming: all.filter((e) => e.date >= today).length,
        past: all.filter((e) => e.date < today).length,
        samples: all.filter((e) => e.sample).length,
        videos: all.filter((e) => e.youtubeUrl || e.recordingUrl).length,
        rsvps: await rsvps.count(),
        newsletter: await newsletter.count(),
        bookings: await bookings.count(),
        newBookings: await bookings.count({ status: 'new' }),
        podcasts: await recordings.count({ type: 'podcast' }),
        reports: await recordings.count({ type: 'report' }),
        recordedVideos: await recordings.count({ type: 'video' }),
        latestRsvps: latest,
      });
    })
  );

  // ---------- events ----------
  r.get(
    '/events',
    h(async (req, res) => {
      const today = todayIST();
      const counts = {};
      for (const x of await rsvps.find({})) counts[x.eventId] = (counts[x.eventId] || 0) + (x.people || 1);
      const list = (await events.find({}, { sort: { date: -1 } })).map((e) => ({
        ...e,
        when: e.date >= today ? 'upcoming' : 'past',
        rsvpCount: counts[e._id] || 0,
        youtubeId: youtubeId(e.youtubeUrl || e.recordingUrl),
        hasVideo: !!(e.youtubeUrl || e.recordingUrl),
      }));
      res.json({ events: list, today, cities: CITIES, categories: CATEGORIES, rsvpModes: RSVP_MODES });
    })
  );

  async function uniqueSlug(title, date, exceptId) {
    const base = `${slugify(title)}-${date}`;
    let slug = base;
    for (let i = 2; ; i++) {
      const hit = await events.findOne({ slug });
      if (!hit || hit._id === exceptId) return slug;
      slug = `${base}-${i}`;
    }
  }

  r.post(
    '/events',
    h(async (req, res) => {
      const { data, errors } = cleanEvent(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      data.slug = await uniqueSlug(data.title, data.date);
      res.json(await events.insertOne({ ...data, sample: false, createdAt: new Date().toISOString() }));
    })
  );

  r.put(
    '/events/:id',
    h(async (req, res) => {
      const old = await events.findOne({ _id: req.params.id });
      if (!old) return res.status(404).json({ error: 'Event not found' });
      const { data, errors } = cleanEvent(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      data.slug = old.title === data.title && old.date === data.date && old.slug ? old.slug : await uniqueSlug(data.title, data.date, old._id);
      // keep old links working (shared on WhatsApp, found in Google): they redirect to the new one
      data.oldSlugs = [...new Set([...(old.oldSlugs || []), old.slug].filter((x) => x && x !== data.slug))].slice(-20);
      if (old.image && old.image !== data.image) removeUpload(old.image);
      const upd = await events.updateOne({ _id: old._id }, { ...data, updatedAt: new Date().toISOString() });
      // keep RSVP list titles in step
      for (const x of await rsvps.find({ eventId: old._id })) await rsvps.updateOne({ _id: x._id }, { eventTitle: data.title, eventDate: data.date, city: data.city });
      res.json(upd);
    })
  );

  r.delete(
    '/events/:id',
    h(async (req, res) => {
      const old = await events.findOne({ _id: req.params.id });
      if (!old) return res.status(404).json({ error: 'Event not found' });
      removeUpload(old.image);
      await events.deleteOne({ _id: old._id });
      for (const x of await rsvps.find({ eventId: old._id })) await rsvps.deleteOne({ _id: x._id });
      res.json({ ok: true });
    })
  );

  r.post(
    '/events/delete-samples',
    h(async (req, res) => {
      let n = 0;
      for (const e of await events.find({ sample: true })) {
        removeUpload(e.image);
        await events.deleteOne({ _id: e._id });
        for (const x of await rsvps.find({ eventId: e._id })) await rsvps.deleteOne({ _id: x._id });
        n++;
      }
      res.json({ ok: true, deleted: n });
    })
  );

  // ---------- image upload (compressed to WebP, photo location data removed) -> S3 or disk ----------
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) =>
      /^image\/(jpeg|png|webp|gif|avif|heic|heif)$/.test(file.mimetype) ? cb(null, true) : cb(new Error('Please upload a JPG, PNG or WebP image')),
  });
  // delete an image we stored (S3 object or local file); sample/static images are left alone
  function removeUpload(url) {
    if (!url) return;
    storage.remove(url).catch((e) => console.error('[images] could not delete', url, e.message));
  }
  r.post('/upload', (req, res, next) =>
    upload.single('image')(req, res, async (err) => {
      if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Image is too large (max 15 MB)' : err.message });
      if (!req.file) return res.status(400).json({ error: 'No image received' });
      try {
        let buf;
        try {
          buf = await sharp(req.file.buffer).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        } catch {
          return res.status(400).json({ error: 'Could not read this image' });
        }
        const url = await storage.save(crypto.randomUUID() + '.webp', buf);
        res.json({ url, storage: storage.kind });
      } catch (e) {
        console.error('[images] upload failed:', e.message);
        res.status(502).json({ error: storage.kind === 's3' ? 'Could not save the image to S3. Check the S3 settings.' : 'Could not save the image' });
      }
    })
  );

  // ---------- report upload: PDF, Word, PowerPoint up to 50 MB -> S3 (project/documents/pcw) or disk ----------
  const DOC_MAX_MB = 50;
  const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: DOC_MAX_MB * 1024 * 1024 } });
  // check the file really is what its name says (first bytes of the file)
  function docType(buf, original) {
    const ext = String(original || '').toLowerCase().split('.').pop();
    const head = buf.subarray(0, 8);
    const isPdf = buf.subarray(0, 5).toString('latin1') === '%PDF-';
    const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    const isOle = head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    const inZip = (dir) => buf.indexOf(Buffer.from(dir), 0, 'latin1') !== -1;
    if (ext === 'pdf' && isPdf) return 'pdf';
    if (ext === 'docx' && isZip && inZip('word/')) return 'docx';
    if (ext === 'pptx' && isZip && inZip('ppt/')) return 'pptx';
    if ((ext === 'doc' || ext === 'ppt') && isOle) return ext;
    return '';
  }
  function removeDoc(url) {
    if (!docNameFromUrl(url)) return;
    storage.removeDoc(url).catch((e) => console.error('[files] could not delete', url, e.message));
  }
  r.post('/upload-doc', (req, res) =>
    docUpload.single('file')(req, res, async (err) => {
      if (err)
        return res.status(400).json({
          error:
            err.code === 'LIMIT_FILE_SIZE'
              ? `This file is bigger than ${DOC_MAX_MB} MB. Put it on Google Drive (or another sharing site), set sharing to "Anyone with the link", and paste the link instead.`
              : err.message,
        });
      if (!req.file) return res.status(400).json({ error: 'No file received' });
      const type = docType(req.file.buffer, req.file.originalname);
      if (!type) return res.status(400).json({ error: 'Please upload a PDF, Word (.doc/.docx) or PowerPoint (.ppt/.pptx) file' });
      try {
        const url = await storage.saveDoc(`${crypto.randomUUID()}.${type}`, req.file.buffer);
        res.json({ url, name: String(req.file.originalname).slice(0, 150), size: req.file.size, type });
      } catch (e) {
        console.error('[files] upload failed:', e.message);
        res.status(502).json({ error: storage.kind === 's3' ? 'Could not save the file to S3. Check the S3 settings.' : 'Could not save the file' });
      }
    })
  );
  r.post(
    '/upload-doc/discard',
    h(async (req, res) => {
      const url = String(req.body?.url || '');
      const used = (await recordings.find({})).some((x) => x.link === url);
      if (!used) removeDoc(url);
      res.json({ ok: true, removed: !used && !!docNameFromUrl(url) });
    })
  );

  // image uploaded in the editor but not used (form cancelled / photo replaced before saving)
  r.post(
    '/upload/discard',
    h(async (req, res) => {
      const url = String(req.body?.url || '');
      const spaces = await Promise.all(spaceCities().map((c) => getSpace(store, c)));
      const used =
        (await events.find({})).some((e) => e.image === url) ||
        (await recordings.find({})).some((x) => x.image === url) ||
        spaces.some((sp) => sp.cards.some((c) => c.image === url));
      if (!used) removeUpload(url);
      res.json({ ok: true, removed: !used });
    })
  );

  // ---------- city spaces ("A Space to Connect in Person") ----------
  r.get(
    '/spaces',
    h(async (req, res) => res.json({ spaces: await Promise.all(spaceCities().map((c) => getSpace(store, c))), cities: CITIES }))
  );
  r.put(
    '/spaces/:city',
    h(async (req, res) => {
      const city = String(req.params.city);
      if (!CITIES[city]) return res.status(404).json({ error: 'Unknown city' });
      const { data, errors } = cleanSpace(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      const old = await getSpace(store, city);
      const keep = new Set(data.cards.map((c) => c.image));
      for (const c of old.cards) if (c.image && !keep.has(c.image)) removeUpload(c.image); // replaced/removed photos leave S3
      await store.collection('settings').updateOne({ _id: `space-${city}` }, { ...data, updatedAt: new Date().toISOString() }, { upsert: true });
      res.json(await getSpace(store, city));
    })
  );

  // ---------- recordings: podcasts / reports / videos ----------
  r.get(
    '/recordings',
    h(async (req, res) => {
      const list = sortRecordings(await recordings.find({})).map((x) => ({ ...x, media: mediaFor(x.link).kind }));
      res.json({ recordings: list, types: TYPES, labels: TYPE_LABELS, cities: CITIES });
    })
  );
  r.post(
    '/recordings',
    h(async (req, res) => {
      const { data, errors } = cleanRecording(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      data.slug = uniqueSlugFor(await recordings.find({}), data.title);
      res.json(await recordings.insertOne({ ...data, sample: false, createdAt: new Date().toISOString() }));
    })
  );
  r.put(
    '/recordings/:id',
    h(async (req, res) => {
      const old = await recordings.findOne({ _id: req.params.id });
      if (!old) return res.status(404).json({ error: 'Not found' });
      const { data, errors } = cleanRecording(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      data.slug = old.title === data.title && old.slug ? old.slug : uniqueSlugFor(await recordings.find({}), data.title, old._id);
      if (old.image && old.image !== data.image) removeUpload(old.image);
      if (old.link && old.link !== data.link) removeDoc(old.link);
      res.json(await recordings.updateOne({ _id: old._id }, { ...data, updatedAt: new Date().toISOString() }));
    })
  );
  r.delete(
    '/recordings/:id',
    h(async (req, res) => {
      const old = await recordings.findOne({ _id: req.params.id });
      if (!old) return res.status(404).json({ error: 'Not found' });
      removeUpload(old.image);
      removeDoc(old.link);
      await recordings.deleteOne({ _id: old._id });
      res.json({ ok: true });
    })
  );
  r.post(
    '/recordings/delete-samples',
    h(async (req, res) => {
      let n = 0;
      for (const x of await recordings.find({ sample: true })) {
        removeUpload(x.image);
        await recordings.deleteOne({ _id: x._id });
        n++;
      }
      res.json({ ok: true, deleted: n });
    })
  );

  // ---------- FAQ ----------
  r.get('/faq', h(async (req, res) => res.json({ items: await getFaq(store), defaults: DEFAULT_FAQ })));
  r.put(
    '/faq',
    h(async (req, res) => {
      const { data, errors } = cleanFaq(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please fill in both the question and the answer', errors });
      await store.collection('settings').updateOne({ _id: 'faq' }, { ...data, updatedAt: new Date().toISOString() }, { upsert: true });
      res.json({ items: await getFaq(store) });
    })
  );

  // ---------- website settings (booking form link) ----------
  r.get('/site', h(async (req, res) => res.json(await getSite(store))));
  r.put(
    '/site',
    h(async (req, res) => {
      const { data, errors } = cleanSite(req.body || {});
      if (Object.keys(errors).length) return res.status(400).json({ error: 'Please check the highlighted fields', errors });
      await store.collection('settings').updateOne({ _id: 'site' }, { ...data, updatedAt: new Date().toISOString() }, { upsert: true });
      res.json(await getSite(store));
    })
  );

  // ---------- RSVPs ----------
  const rsvpCols = ['createdAt', 'city', 'eventDate', 'eventTitle', 'name', 'email', 'phone', 'organisation', 'people'];
  async function listRsvps(q) {
    let list = await rsvps.find(q.eventId ? { eventId: String(q.eventId) } : {}, { sort: { createdAt: -1 } });
    const s = String(q.q || '').trim().toLowerCase();
    if (s) list = list.filter((x) => [x.name, x.email, x.phone, x.organisation, x.eventTitle].join(' ').toLowerCase().includes(s));
    return list;
  }
  r.get('/rsvps', h(async (req, res) => res.json({ rsvps: await listRsvps(req.query) })));
  r.get(
    '/rsvps.csv',
    h(async (req, res) => sendCsv(res, `rsvps-${todayIST()}.csv`, toCsv(await listRsvps(req.query), rsvpCols)))
  );
  r.delete(
    '/rsvps/:id',
    h(async (req, res) => res.json({ ok: await rsvps.deleteOne({ _id: req.params.id }) }))
  );

  // ---------- newsletter ----------
  r.get('/newsletter', h(async (req, res) => res.json({ subscribers: await newsletter.find({}, { sort: { createdAt: -1 } }) })));
  r.get(
    '/newsletter.csv',
    h(async (req, res) => sendCsv(res, `newsletter-${todayIST()}.csv`, toCsv(await newsletter.find({}, { sort: { createdAt: 1 } }), ['createdAt', 'email', 'source'])))
  );
  r.delete('/newsletter/:id', h(async (req, res) => res.json({ ok: await newsletter.deleteOne({ _id: req.params.id }) })));

  // ---------- bookings ----------
  r.get('/bookings', h(async (req, res) => res.json({ bookings: await bookings.find({}, { sort: { createdAt: -1 } }), statuses: BOOKING_STATUSES })));
  r.patch(
    '/bookings/:id',
    h(async (req, res) => {
      if (!BOOKING_STATUSES.includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status' });
      const b = await bookings.updateOne({ _id: req.params.id }, { status: req.body.status });
      if (!b) return res.status(404).json({ error: 'Not found' });
      res.json(b);
    })
  );
  r.delete('/bookings/:id', h(async (req, res) => res.json({ ok: await bookings.deleteOne({ _id: req.params.id }) })));
  r.get(
    '/bookings.csv',
    h(async (req, res) =>
      sendCsv(
        res,
        `bookings-${todayIST()}.csv`,
        toCsv(await bookings.find({}, { sort: { createdAt: 1 } }), ['createdAt', 'city', 'name', 'email', 'phone', 'organisation', 'purpose', 'date', 'people', 'message', 'status'])
      )
    )
  );

  function sendCsv(res, name, csv) {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${name}"`);
    res.send(csv);
  }

  return r;
}
