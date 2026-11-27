import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { boot } from '../src/boot.js';
import { youtubeId } from '../src/lib/events.js';

let app, tmp, store, agent;
const fut = (d) => new Date(Date.now() + 864e5 * d).toISOString().slice(0, 10);

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-'));
  fs.mkdirSync(path.join(tmp, 'dist'));
  fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), '<html><head><title>PCW</title><meta name="description" content="x"></head><body><div id="root"></div></body></html>');
  ({ app, store } = await boot({
    jsonFile: path.join(tmp, 'db.json'),
    // TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test  -> runs the same tests on MongoDB
    mongoUri: process.env.TEST_MONGODB_URI ? `${process.env.TEST_MONGODB_URI}/pcw_test_api_${Date.now()}` : '',
    clientDist: path.join(tmp, 'dist'),
    cdnCache: path.join(tmp, 'cdn'),
    dataDir: tmp,
    uploadDir: path.join(tmp, 'uploads'),
    adminUsername: 'admin',
    adminPassword: 'Pcw@2026',
    seedSamples: true,
  }));
  agent = request.agent(app);
});
after(async () => {
  await store.close?.();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const login = (pw = 'Pcw@2026') => agent.post('/api/admin/login').send({ username: 'admin', password: pw });

test('health + website fallback', async () => {
  assert.equal((await request(app).get('/api/health').expect(200)).body.db, process.env.TEST_MONGODB_URI ? 'mongo' : 'json');
  assert.match((await request(app).get('/space/bangalore').expect(200)).text, /PCW/);
  await request(app).get('/api/unknown').expect(404);
  await request(app).get('/cdn/..%2F..%2Fetc/passwd').expect(404);
});

test('youtube links are understood', () => {
  for (const u of ['https://www.youtube.com/watch?v=NT-gVjZCct8', 'https://youtu.be/NT-gVjZCct8?si=x', 'https://www.youtube.com/embed/NT-gVjZCct8', 'https://youtube.com/shorts/NT-gVjZCct8', 'NT-gVjZCct8'])
    assert.equal(youtubeId(u), 'NT-gVjZCct8', u);
  assert.equal(youtubeId('https://vimeo.com/1'), '');
});

test('sample events are seeded once, split into upcoming/past, with videos', async () => {
  const b = (await request(app).get('/api/events?city=bangalore').expect(200)).body;
  assert.ok(b.upcoming.length >= 1 && b.past.length >= 1);
  assert.ok(b.upcoming.every((e) => e.date >= b.today) && b.past.every((e) => e.date < b.today));
  assert.ok(b.categories.includes('Talks'));
  assert.ok(b.upcoming[0].sample);
  const v = (await request(app).get('/api/videos').expect(200)).body;
  assert.ok(v.videos.length >= 3 && v.videos.every((x) => x.youtubeId.length === 11));
  await request(app).get('/api/events?city=delhi').expect(404);
});

test('event detail, related and calendar file', async () => {
  const b = (await request(app).get('/api/events?city=bangalore')).body;
  const ev = b.upcoming[0];
  const d = (await request(app).get(`/api/events/${ev.slug}`).expect(200)).body;
  assert.equal(d.event.title, ev.title);
  assert.ok(Array.isArray(d.related));
  const ics = await request(app).get(`/api/events/${ev.slug}/ics`).expect(200);
  assert.match(ics.text, /BEGIN:VEVENT/);
  assert.match(ics.text, /DTSTART;TZID=Asia\/Kolkata:/);
  await request(app).get('/api/events/nope-nope').expect(404);
});

test('RSVP: saves once, refuses closed / past / full', async () => {
  const b = (await request(app).get('/api/events?city=bangalore')).body;
  const open = b.upcoming.find((e) => e.rsvpStatus === 'open');
  const closed = b.upcoming.find((e) => e.rsvpStatus === 'closed');
  await request(app).post('/api/rsvp').send({ eventId: open.id, name: 'Ravi', email: 'RAVI@x.org', people: 2 }).expect(200);
  await request(app).post('/api/rsvp').send({ eventId: open.id, name: 'Ravi', email: 'ravi@x.org' }).expect(200);
  assert.equal(await store.collection('rsvps').count({ eventId: open.id }), 1);
  await request(app).post('/api/rsvp').send({ eventId: closed.id, name: 'A', email: 'a@b.co' }).expect(400);
  await request(app).post('/api/rsvp').send({ eventId: b.past[0].id, name: 'A', email: 'a@b.co' }).expect(400);
  const bad = await request(app).post('/api/rsvp').send({ eventId: open.id, email: 'x' }).expect(400);
  assert.ok(bad.body.errors.name && bad.body.errors.email);
});

test('newsletter + bookings', async () => {
  await request(app).post('/api/newsletter').send({ email: 'Asha@Example.org' }).expect(200);
  await request(app).post('/api/newsletter').send({ email: 'asha@example.org' }).expect(200);
  await request(app).post('/api/newsletter').send({ email: 'nope' }).expect(400);
  assert.equal(await store.collection('newsletter').count(), 1);
  await request(app).post('/api/bookings').send({ city: 'guwahati', name: 'Mina', email: 'm@x.org', phone: '9876543210', purpose: 'Host an event', date: fut(10) }).expect(200);
});

test('admin: needs login, wrong password refused', async () => {
  await request(app).get('/api/admin/stats').expect(401);
  await request(app).get('/api/admin/events').expect(401);
  await login('wrong').expect(401);
});

test('admin: events create / edit / capacity / delete, samples delete', async () => {
  await login().expect(200);
  const s = (await agent.get('/api/admin/stats').expect(200)).body;
  assert.ok(s.samples > 0 && s.rsvps >= 1);

  const bad = await agent.post('/api/admin/events').send({ city: 'x', title: '', date: 'no', youtubeUrl: 'not a link', startTime: '10:00', endTime: '09:00' }).expect(400);
  for (const k of ['city', 'title', 'date', 'youtubeUrl', 'endTime']) assert.ok(bad.body.errors[k], k);

  const date = fut(30);
  const ev = (
    await agent
      .post('/api/admin/events')
      .send({ city: 'guwahati', title: 'Real Event', date, startTime: '10:00', endTime: '12:00', category: 'Talks', rsvp: 'open', capacity: 2, speakers: [{ name: 'Asha', role: 'Host' }, { name: '' }], youtubeUrl: 'https://youtu.be/Yw1oFCemAxE' })
      .expect(200)
  ).body;
  assert.equal(ev.slug, `real-event-${date}`);
  assert.equal(ev.speakers.length, 1);
  // same title+date -> unique slug
  const ev2 = (await agent.post('/api/admin/events').send({ city: 'guwahati', title: 'Real Event', date }).expect(200)).body;
  assert.equal(ev2.slug, `real-event-${date}-2`);

  // capacity 2: one RSVP for 2 people fills it
  await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'A', email: 'a@x.org', people: 3 }).expect(400);
  await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'A', email: 'a@x.org', people: 2 }).expect(200);
  const d = (await request(app).get(`/api/events/${ev.slug}`)).body;
  assert.equal(d.event.rsvpStatus, 'full');
  await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'B', email: 'b@x.org' }).expect(400);

  // edit: unpublish hides it
  await agent.put(`/api/admin/events/${ev._id}`).send({ ...ev, title: 'Real Event Updated', published: false }).expect(200);
  await request(app).get(`/api/events/${ev.slug}`).expect(404);
  const r = (await agent.get(`/api/admin/rsvps?eventId=${ev._id}`).expect(200)).body.rsvps;
  assert.equal(r[0].eventTitle, 'Real Event Updated');
  const csv = await agent.get(`/api/admin/rsvps.csv?eventId=${ev._id}`).expect(200);
  assert.match(csv.text, /a@x.org/);

  await agent.delete(`/api/admin/events/${ev._id}`).expect(200);
  assert.equal(await store.collection('rsvps').count({ eventId: ev._id }), 0);

  const del = (await agent.post('/api/admin/events/delete-samples').expect(200)).body;
  assert.ok(del.deleted > 0);
  assert.equal((await agent.get('/api/admin/stats')).body.samples, 0);
});

test('admin: image upload, newsletter, bookings, password', async () => {
  await login().expect(200);
  const png = await sharp({ create: { width: 64, height: 32, channels: 3, background: '#f60' } }).png().toBuffer();
  const up = (await agent.post('/api/admin/upload').attach('image', png, 'photo.png').expect(200)).body;
  assert.match(up.url, /^\/uploads\/.+\.webp$/);
  await request(app).get(up.url).expect(200);
  await agent.post('/api/admin/upload').attach('image', Buffer.from('x'), 'a.txt').expect(400);

  assert.equal((await agent.get('/api/admin/newsletter').expect(200)).body.subscribers.length, 1);
  assert.match((await agent.get('/api/admin/newsletter.csv').expect(200)).text, /asha@example.org/);
  const bk = (await agent.get('/api/admin/bookings').expect(200)).body.bookings[0];
  await agent.patch(`/api/admin/bookings/${bk._id}`).send({ status: 'confirmed' }).expect(200);
  await agent.patch(`/api/admin/bookings/${bk._id}`).send({ status: 'weird' }).expect(400);

  await agent.post('/api/admin/password').send({ current: 'nope', next: 'NewPass123' }).expect(400);
  await agent.post('/api/admin/password').send({ current: 'Pcw@2026', next: 'NewPass123' }).expect(200);
  await agent.post('/api/admin/logout').expect(200);
  await agent.get('/api/admin/me').expect(401);
  await login('Pcw@2026').expect(401);
  await login('NewPass123').expect(200);
});

test('city spaces: defaults, admin edit, validation', async () => {
  const b = (await request(app).get('/api/spaces/bangalore').expect(200)).body;
  assert.equal(b.cards.length, 3);
  assert.ok(b.cards.every((c) => c.image.startsWith('/assets/')));
  const g = (await request(app).get('/api/spaces/guwahati').expect(200)).body;
  assert.ok(g.cards.every((c) => c.image === ''));
  await request(app).get('/api/spaces/delhi').expect(404);
  await request(app).put('/api/admin/spaces/guwahati').send(g).expect(401);

  await login('NewPass123').expect(200);
  const bad = await agent.put('/api/admin/spaces/guwahati').send({ ...g, title: '', cards: [{ title: '', image: 'javascript:x' }] }).expect(400);
  assert.ok(bad.body.errors.title && bad.body.errors.card0);
  g.cards[0].image = '/uploads/00000000-0000-0000-0000-000000000000.webp';
  g.title = 'Our Guwahati Space';
  await agent.put('/api/admin/spaces/guwahati').send(g).expect(200);
  const g2 = (await request(app).get('/api/spaces/guwahati')).body;
  assert.equal(g2.title, 'Our Guwahati Space');
  assert.equal(g2.cards[0].image, g.cards[0].image);
  // an image used by a space is not discarded
  assert.equal((await agent.post('/api/admin/upload/discard').send({ url: g.cards[0].image })).body.removed, false);
  assert.equal((await agent.get('/api/admin/spaces').expect(200)).body.spaces.length, 2);
});

async function loginAny() {
  if ((await login('NewPass123')).status !== 200) await login().expect(200);
}

test('recordings: samples, tabs, event videos, link types', async () => {
  const p = (await request(app).get('/api/recordings?type=podcast').expect(200)).body;
  assert.equal(p.type, 'podcast');
  assert.ok(p.items.length >= 3 && p.items.every((x) => x.type === 'podcast'));
  assert.equal(p.items[0].media.kind, 'youtube'); // newest first
  assert.ok(p.counts.report >= 2 && p.counts.video >= 0);
  const v = (await request(app).get('/api/recordings?type=video').expect(200)).body;
  assert.ok(v.items.every((x) => x.type === 'video' && (x.source !== 'event' || x.eventUrl.startsWith('/event/'))));
  assert.equal(v.items.length, v.counts.video);
  assert.equal((await request(app).get('/api/recordings?type=weird').expect(200)).body.type, 'podcast');

  const { mediaFor } = await import('../src/lib/recordings.js');
  assert.equal(mediaFor('https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=1').embed, 'https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk');
  assert.equal(mediaFor('https://soundcloud.com/pcw/ep-1').kind, 'soundcloud');
  assert.equal(mediaFor('https://podcasts.apple.com/in/podcast/x/id123?i=456').embed, 'https://embed.podcasts.apple.com/in/podcast/x/id123?i=456');
  assert.equal(mediaFor('https://drive.google.com/file/d/AbC_12-x/view?usp=sharing').embed, 'https://drive.google.com/file/d/AbC_12-x/preview');
  assert.equal(mediaFor('https://example.org/a.mp3').kind, 'audio');
  assert.equal(mediaFor('https://example.org/report.pdf').kind, 'pdf');
  assert.equal(mediaFor('https://example.org/page').kind, 'link');
  assert.equal(mediaFor('javascript:alert(1)').kind, 'link'); // never embedded
});

test('admin: recordings create / edit / hide / delete, samples delete, image cleanup', async () => {
  await request(app).get('/api/admin/recordings').expect(401);
  await loginAny();
  await agent.post('/api/admin/recordings').send({ type: 'podcast', title: '' }).expect(400);
  await agent.post('/api/admin/recordings').send({ type: 'podcast', title: 'X', link: 'javascript:alert(1)' }).expect(400);
  // video links can be from any site now; uploaded files only for reports
  await agent.post('/api/admin/recordings').send({ type: 'video', title: 'X', link: '/files/0f8fad5b-d9cb-469f-a165-70867728950e.pdf' }).expect(400);
  const png = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#0a0' } }).png().toBuffer();
  const img = (await agent.post('/api/admin/upload').attach('image', png, 'c.png').expect(200)).body.url;
  const made = (
    await agent
      .post('/api/admin/recordings')
      .send({ type: 'podcast', title: 'Real Episode', number: '7', speakers: 'A, with B', link: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk', image: img, date: '2099-01-01' })
      .expect(200)
  ).body;
  let p = (await request(app).get('/api/recordings?type=podcast')).body;
  assert.equal(p.items[0].title, 'Real Episode');
  assert.equal(p.items[0].media.kind, 'spotify');

  const img2 = (await agent.post('/api/admin/upload').attach('image', png, 'd.png').expect(200)).body.url;
  await agent.put(`/api/admin/recordings/${made._id}`).send({ ...made, type: 'report', image: img2, published: false }).expect(200);
  await request(app).get(img).expect(404); // replaced cover removed
  p = (await request(app).get('/api/recordings?type=report')).body;
  assert.ok(!p.items.some((x) => x.title === 'Real Episode')); // hidden
  // discard keeps a cover that is in use
  assert.equal((await agent.post('/api/admin/upload/discard').send({ url: img2 }).expect(200)).body.removed, false);

  const del = (await agent.post('/api/admin/recordings/delete-samples').send({}).expect(200)).body;
  assert.ok(del.deleted >= 5);
  await agent.delete(`/api/admin/recordings/${made._id}`).expect(200);
  await request(app).get(img2).expect(404);
  assert.equal((await agent.get('/api/admin/recordings').expect(200)).body.recordings.length, 0);
  assert.equal((await request(app).get('/api/recordings?type=podcast')).body.items.length, 0);
});

test('site settings: booking form link', async () => {
  const d = (await request(app).get('/api/site').expect(200)).body;
  assert.match(d.bookingUrl, /^https:\/\/docs\.google\.com\/forms\//);
  await request(app).put('/api/admin/site').send({ bookingUrl: 'https://x.org' }).expect(401);
  await loginAny();
  await agent.put('/api/admin/site').send({ bookingUrl: 'http://not-https.org' }).expect(400);
  await agent.put('/api/admin/site').send({ bookingUrl: 'https://forms.gle/abc' }).expect(200);
  assert.equal((await request(app).get('/api/site')).body.bookingUrl, 'https://forms.gle/abc');
  await agent.put('/api/admin/site').send({ bookingUrl: '' }).expect(200);
  assert.equal((await request(app).get('/api/site')).body.bookingUrl, d.bookingUrl);
});

test('admin login follows .env (ADMIN_USERNAME / ADMIN_PASSWORD)', async () => {
  const { ensureAdmin } = await import('../src/lib/auth.js');
  assert.equal((await ensureAdmin(store, 'manthan', 'Selco@2026')).changed, true);
  assert.equal((await ensureAdmin(store, 'manthan', 'Selco@2026')).changed, false);
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(401);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  await a.get('/api/admin/me').expect(200);
  assert.equal((await store.collection('admins').count()), 1);
});

test('event registration: our RSVP form, form link, closed, none', async () => {
  // the previous test switched the login to the .env values below
  const agent = request.agent(app);
  await agent.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const base = { city: 'guwahati', title: 'Reg Test', date: '2099-03-01', startTime: '10:00' };
  // form link needs a valid link
  let r = await agent.post('/api/admin/events').send({ ...base, rsvp: 'link' }).expect(400);
  assert.ok(r.body.errors.rsvpUrl);
  r = await agent.post('/api/admin/events').send({ ...base, rsvp: 'link', rsvpUrl: 'javascript:alert(1)' }).expect(400);
  assert.ok(r.body.errors.rsvpUrl);
  const ev = (await agent.post('/api/admin/events').send({ ...base, rsvp: 'link', rsvpUrl: 'https://forms.gle/abc123', capacity: 30 }).expect(200)).body;
  assert.equal(ev.capacity, null); // seats only for our own form
  let pub = (await request(app).get(`/api/events/${ev.slug}`).expect(200)).body.event;
  assert.equal(pub.rsvpStatus, 'link');
  assert.equal(pub.rsvpUrl, 'https://forms.gle/abc123');
  const list = (await request(app).get('/api/events?city=guwahati').expect(200)).body;
  assert.equal(list.upcoming.find((x) => x.slug === ev.slug).rsvpUrl, 'https://forms.gle/abc123');
  // our RSVP endpoint refuses link events
  r = await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'A', email: 'a@b.co', people: 1 }).expect(400);
  assert.match(r.body.error, /form link/);

  // switch to our own form with 1 seat
  await agent.put(`/api/admin/events/${ev._id}`).send({ ...base, rsvp: 'open', rsvpUrl: 'https://forms.gle/abc123', capacity: 1 }).expect(200);
  pub = (await request(app).get(`/api/events/${ev.slug}`)).body.event;
  assert.equal(pub.rsvpStatus, 'open');
  assert.equal(pub.rsvpUrl, ''); // old link not shown
  await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'A', email: 'a@b.co', people: 1 }).expect(200);
  assert.equal((await request(app).get(`/api/events/${ev.slug}`)).body.event.rsvpStatus, 'full');
  // same email again (any capitals): told they are already registered, not counted twice
  const again = (await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'A', email: 'A@B.CO', people: 1 }).expect(200)).body;
  assert.equal(again.already, true);
  assert.match(again.message, /already registered/);
  assert.equal((await store.collection('rsvps').find({ eventId: ev._id })).length, 1);
  // someone new: event is full
  assert.match((await request(app).post('/api/rsvp').send({ eventId: ev._id, name: 'B', email: 'b@b.co', people: 1 }).expect(400)).body.error, /full/);

  // closed and none
  await agent.put(`/api/admin/events/${ev._id}`).send({ ...base, rsvp: 'closed' }).expect(200);
  assert.equal((await request(app).get(`/api/events/${ev.slug}`)).body.event.rsvpStatus, 'closed');
  await agent.put(`/api/admin/events/${ev._id}`).send({ ...base, rsvp: 'none' }).expect(200);
  assert.equal((await request(app).get(`/api/events/${ev.slug}`)).body.event.rsvpStatus, 'none');
  // past event with a link: no register button
  const moved = (await agent.put(`/api/admin/events/${ev._id}`).send({ ...base, date: '2020-01-01', rsvp: 'link', rsvpUrl: 'https://forms.gle/abc123' }).expect(200)).body;
  const past = (await request(app).get(`/api/events/${moved.slug}`).expect(200)).body.event;
  assert.equal(past.rsvpStatus, 'over');
  assert.equal(past.rsvpUrl, '');
  // the old link still works and leads to the event
  assert.equal((await request(app).get(`/api/events/${ev.slug}`).expect(200)).body.event.slug, moved.slug);
  const redirect = await request(app).get(`/event/${ev.slug}`).expect(301);
  assert.equal(redirect.headers.location, `/event/${moved.slug}`);
  await agent.delete(`/api/admin/events/${ev._id}`).expect(200);
});

test('event video: any site (YouTube, Vimeo, Drive, other) is accepted and shown', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const base = { city: 'bangalore', title: 'Video Any Site', date: '2020-02-02', rsvp: 'none' };
  await a.post('/api/admin/events').send({ ...base, youtubeUrl: 'javascript:alert(1)' }).expect(400);
  const cases = [
    ['https://vimeo.com/123456789', 'vimeo'],
    ['https://drive.google.com/file/d/AbC_12-x/view', 'drive'],
    ['https://example.org/talk.mp4', 'video'],
    ['https://www.facebook.com/selco/videos/123', 'link'],
  ];
  for (const [url, kind] of cases) {
    const ev = (await a.post('/api/admin/events').send({ ...base, title: `Video ${kind}`, youtubeUrl: url, contentType: 'video' }).expect(200)).body;
    const pub = (await request(app).get(`/api/events/${ev.slug}`).expect(200)).body.event;
    assert.equal(pub.video.kind, kind);
    assert.equal(pub.video.url, url);
    const vids = (await request(app).get('/api/recordings?type=video')).body.items;
    assert.ok(vids.some((x) => x.title === `Video ${kind}` && x.link === url), kind);
    await a.delete(`/api/admin/events/${ev._id}`).expect(200);
  }
});

test('report upload: PDF/Word/PowerPoint only, 50 MB limit, served with its name, cleaned up', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  await request(app).post('/api/admin/upload-doc').attach('file', Buffer.from('%PDF-1.4 x'), 'r.pdf').expect(401);
  // wrong content for the extension
  let r = await a.post('/api/admin/upload-doc').attach('file', Buffer.from('hello'), 'fake.pdf').expect(400);
  assert.match(r.body.error, /PDF, Word/);
  await a.post('/api/admin/upload-doc').attach('file', Buffer.from('%PDF-1.4'), 'x.exe').expect(400);
  // too big: told to use Google Drive
  r = await a.post('/api/admin/upload-doc').attach('file', Buffer.alloc(50 * 1024 * 1024 + 10, 0x25), 'big.pdf').expect(400);
  assert.match(r.body.error, /bigger than 50 MB.*Google Drive/);

  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(2000, 0x20)]);
  const up = (await a.post('/api/admin/upload-doc').attach('file', pdf, 'Annual Report 2026.pdf').expect(200)).body;
  assert.match(up.url, /^\/files\/[a-f0-9-]{36}\.pdf$/);
  assert.equal(up.name, 'Annual Report 2026.pdf');
  const docx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....word/document.xml....')]);
  const upDocx = (await a.post('/api/admin/upload-doc').attach('file', docx, 'Notes.docx').expect(200)).body;
  const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(100)]);
  const upPpt = (await a.post('/api/admin/upload-doc').attach('file', ole, 'Deck.ppt').expect(200)).body;

  // not linked to anything yet: not public
  await request(app).get(up.url).expect(404);
  const rec = (await a.post('/api/admin/recordings').send({ type: 'report', title: 'Annual Report', link: up.url, fileName: up.name, fileSize: up.size }).expect(200)).body;
  const file = await request(app).get(up.url).expect(200);
  assert.equal(file.headers['content-type'], 'application/pdf');
  assert.match(file.headers['content-disposition'], /^inline; filename="Annual Report 2026\.pdf"/);
  const pub = (await request(app).get('/api/recordings?type=report')).body.items.find((x) => x.title === 'Annual Report');
  assert.equal(pub.media.kind, 'pdf');
  assert.equal(pub.fileName, 'Annual Report 2026.pdf');
  // uploaded files only for reports
  await a.post('/api/admin/recordings').send({ type: 'podcast', title: 'X', link: up.url }).expect(400);

  // replace with the Word file: old PDF removed
  await a.put(`/api/admin/recordings/${rec._id}`).send({ ...rec, link: upDocx.url, fileName: upDocx.name, fileSize: upDocx.size }).expect(200);
  const w = await request(app).get(upDocx.url).expect(200);
  assert.match(w.headers['content-disposition'], /^attachment; filename="Notes\.docx"/);
  const dir = path.join(tmp, 'uploads', 'files');
  assert.ok(!fs.existsSync(path.join(dir, up.url.split('/').pop())));
  // switching to a Google Drive link removes the uploaded file and its name
  const linked = (await a.put(`/api/admin/recordings/${rec._id}`).send({ ...rec, link: 'https://drive.google.com/file/d/Abc123/view', fileName: 'x', fileSize: 5 }).expect(200)).body;
  assert.equal(linked.fileName, '');
  assert.ok(!fs.existsSync(path.join(dir, upDocx.url.split('/').pop())));
  // unused upload (form cancelled) is discarded; used ones are kept
  assert.equal((await a.post('/api/admin/upload-doc/discard').send({ url: upPpt.url }).expect(200)).body.removed, true);
  assert.ok(!fs.existsSync(path.join(dir, upPpt.url.split('/').pop())));
  await a.delete(`/api/admin/recordings/${rec._id}`).expect(200);
});

test('event documents: upload, link, served with name, hidden when unpublished, cleaned up', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(500, 0x20)]);
  const up1 = (await a.post('/api/admin/upload-doc').attach('file', pdf, 'Agenda.pdf').expect(200)).body;
  const pptx = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from('....ppt/presentation.xml....')]);
  const up2 = (await a.post('/api/admin/upload-doc').attach('file', pptx, 'Slides.pptx').expect(200)).body;
  const dir = path.join(tmp, 'uploads', 'files');
  const base = { city: 'bangalore', title: 'Docs Event', date: fut(-3), category: 'Talks' };

  // bad link refused
  let r = await a.post('/api/admin/events').send({ ...base, attachments: [{ url: 'not a link', name: 'x' }] }).expect(400);
  assert.match(r.body.errors.attachments, /https/);
  // more than 10 refused
  r = await a.post('/api/admin/events').send({ ...base, attachments: Array.from({ length: 11 }, (_, i) => ({ url: `https://example.org/${i}.pdf`, name: `D${i}` })) }).expect(400);
  assert.match(r.body.errors.attachments, /10/);

  const ev = (
    await a
      .post('/api/admin/events')
      .send({
        ...base,
        attachments: [
          { url: up1.url, name: 'Agenda.pdf', size: up1.size },
          { url: up2.url, name: 'Slides', size: up2.size },
          { url: 'https://drive.google.com/file/d/Big123/view', name: 'Full report (Drive)', size: 999 },
          { url: '', name: 'empty row dropped' },
        ],
      })
      .expect(200)
  ).body;
  assert.equal(ev.attachments.length, 3);
  assert.equal(ev.attachments[2].size, 0); // links have no size

  const pub = (await request(app).get(`/api/events/${ev.slug}`).expect(200)).body;
  assert.deepEqual(
    pub.event.attachments.map((x) => x.kind),
    ['pdf', 'pptx', 'link']
  );
  assert.ok(Array.isArray(pub.videos));
  // files are served with their names
  assert.match((await request(app).get(up1.url).expect(200)).headers['content-disposition'], /^inline; filename="Agenda\.pdf"/);
  assert.match((await request(app).get(up2.url).expect(200)).headers['content-disposition'], /^attachment; filename="Slides\.pptx"/);
  // used files are not discarded
  assert.equal((await a.post('/api/admin/upload-doc/discard').send({ url: up1.url }).expect(200)).body.removed, false);

  // hidden event: its files are not public
  await a.put(`/api/admin/events/${ev._id}`).send({ ...ev, published: false }).expect(200);
  await request(app).get(up1.url).expect(404);
  // removing a document deletes the file
  await a.put(`/api/admin/events/${ev._id}`).send({ ...ev, published: true, attachments: [ev.attachments[0], ev.attachments[2]] }).expect(200);
  await new Promise((res) => setTimeout(res, 50));
  assert.ok(!fs.existsSync(path.join(dir, up2.url.split('/').pop())));
  await request(app).get(up1.url).expect(200);
  // old events without documents still work
  const old = (await request(app).get('/api/events?city=bangalore')).body.past.find((x) => x.title !== 'Docs Event');
  if (old) assert.deepEqual((await request(app).get(`/api/events/${old.slug}`)).body.event.attachments, []);
  // deleting the event deletes its files
  await a.delete(`/api/admin/events/${ev._id}`).expect(200);
  await new Promise((res) => setTimeout(res, 50));
  assert.ok(!fs.existsSync(path.join(dir, up1.url.split('/').pop())));
});

test('event page suggests other videos (event recordings + Recordings videos), not itself', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const e1 = (await a.post('/api/admin/events').send({ city: 'guwahati', title: 'Vid One', date: fut(-10), category: 'Film & Screenings', youtubeUrl: 'https://youtu.be/NT-gVjZCct8', contentType: 'video' }).expect(200)).body;
  const e2 = (await a.post('/api/admin/events').send({ city: 'guwahati', title: 'Vid Two', date: fut(-5), category: 'Film & Screenings', youtubeUrl: 'https://vimeo.com/12345', contentType: 'video' }).expect(200)).body;
  const rec = (await a.post('/api/admin/recordings').send({ type: 'video', title: 'Rec Video', link: 'https://youtu.be/ps65pgdaw6U', category: 'Film & Screenings', city: 'guwahati', date: fut(-1) }).expect(200)).body;
  const v = (await request(app).get(`/api/events/${e1.slug}`).expect(200)).body.videos;
  assert.ok(v.length >= 2 && v.length <= 4);
  assert.ok(!v.some((x) => x.title === 'Vid One'));
  const two = v.find((x) => x.title === 'Vid Two');
  assert.equal(two.href, `/event/${e2.slug}#watch`);
  const r = v.find((x) => x.title === 'Rec Video');
  assert.equal(r.href, `/recordings/videos#play=${rec.slug}`);
  assert.match(r.image, /ytimg\.com\/vi\/ps65pgdaw6U/);
  for (const id of [e1._id, e2._id]) await a.delete(`/api/admin/events/${id}`).expect(200);
  await a.delete(`/api/admin/recordings/${rec._id}`).expect(200);
});

test('content type: None stays in events, Video -> Recordings > Videos, Podcast -> Podcasts, old events stay in Videos', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const base = { city: 'bangalore', date: fut(-2), category: 'Talks' };
  const none = (await a.post('/api/admin/events').send({ ...base, title: 'CT None', youtubeUrl: 'https://youtu.be/NT-gVjZCct8' }).expect(200)).body;
  const vid = (await a.post('/api/admin/events').send({ ...base, title: 'CT Video', youtubeUrl: 'https://youtu.be/ps65pgdaw6U', contentType: 'video' }).expect(200)).body;
  const pod = (await a.post('/api/admin/events').send({ ...base, title: 'CT Podcast', youtubeUrl: 'https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk', contentType: 'podcast' }).expect(200)).body;
  const noLink = (await a.post('/api/admin/events').send({ ...base, title: 'CT No link', contentType: 'podcast' }).expect(200)).body;
  const bogus = (await a.post('/api/admin/events').send({ ...base, title: 'CT Bogus', youtubeUrl: 'https://youtu.be/ps65pgdaw6U', contentType: 'report' }).expect(200)).body;
  assert.equal(none.contentType, '');
  assert.equal(bogus.contentType, '');
  // an event saved before this option existed (no contentType in the database)
  await store.collection('events').updateOne({ _id: vid._id }, { contentType: null });
  const legacy = (await store.collection('events').find({})).find((e) => e._id === vid._id);
  assert.equal(legacy.contentType ?? null, null);

  const titles = async (type) => (await request(app).get(`/api/recordings?type=${type}`).expect(200)).body.items.map((x) => x.title);
  const videos = await titles('video');
  const podcasts = await titles('podcast');
  assert.ok(videos.includes('CT Video')); // old event: still in Videos
  assert.ok(!videos.includes('CT None') && !podcasts.includes('CT None'));
  assert.ok(!videos.includes('CT Bogus'));
  assert.ok(podcasts.includes('CT Podcast') && !videos.includes('CT Podcast'));
  assert.ok(!podcasts.includes('CT No link'));
  const podItem = (await request(app).get('/api/recordings?type=podcast')).body.items.find((x) => x.title === 'CT Podcast');
  assert.equal(podItem.type, 'podcast');
  assert.equal(podItem.media.kind, 'spotify');
  assert.equal(podItem.eventUrl, `/event/${pod.slug}`);
  const counts = (await request(app).get('/api/recordings?type=podcast')).body.counts;
  assert.ok(counts.podcast >= 1);
  // all of them are still normal events
  const past = (await request(app).get('/api/events?city=bangalore')).body.past.map((e) => e.title);
  for (const t of ['CT None', 'CT Video', 'CT Podcast', 'CT No link']) assert.ok(past.includes(t), t);
  assert.equal((await request(app).get(`/api/events/${pod.slug}`)).body.event.contentType, 'podcast');
  // "Watch more" only suggests videos
  const sug = (await request(app).get(`/api/events/${none.slug}`)).body.videos.map((v) => v.title);
  assert.ok(sug.includes('CT Video') && !sug.includes('CT Podcast'));
  // SEO page for podcasts lists the event too
  const html = (await request(app).get('/recordings/podcasts').expect(200)).text;
  assert.match(html, /CT Podcast/);
  for (const e of [none, vid, pod, noLink, bogus]) await a.delete(`/api/admin/events/${e._id}`).expect(200);
});

test('event report: optional, shows in Reports + event page, file served, cleaned up', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'manthan', password: 'Selco@2026' }).expect(200);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(400, 0x20)]);
  const up = (await a.post('/api/admin/upload-doc').attach('file', pdf, 'Outcome.pdf').expect(200)).body;
  const dir = path.join(tmp, 'uploads', 'files');
  // upcoming event with nothing ticked is fine
  const plain = (await a.post('/api/admin/events').send({ city: 'guwahati', title: 'Plain upcoming', date: fut(10) }).expect(200)).body;
  assert.equal(plain.report, null);
  assert.equal(plain.contentType, '');
  // bad report link refused
  const bad = await a.post('/api/admin/events').send({ city: 'guwahati', title: 'Bad', date: fut(-2), report: { url: 'nope' } }).expect(400);
  assert.match(bad.body.errors.report, /https/);
  // report + video together
  const ev = (await a.post('/api/admin/events').send({ city: 'guwahati', title: 'Report Event', date: fut(-2), category: 'Talks', youtubeUrl: 'https://youtu.be/NT-gVjZCct8', contentType: 'video', report: { url: up.url, name: 'Outcome.pdf', size: up.size, title: '' } }).expect(200)).body;
  const reps = (await request(app).get('/api/recordings?type=report').expect(200)).body.items;
  const r = reps.find((x) => x.eventUrl === `/event/${ev.slug}`);
  assert.ok(r, 'event report listed in Reports');
  assert.equal(r.title, 'Report Event'); // empty title -> event title
  assert.equal(r.link, up.url);
  const vids = (await request(app).get('/api/recordings?type=video').expect(200)).body.items;
  assert.ok(vids.some((x) => x.eventUrl === `/event/${ev.slug}`), 'still in Videos too');
  const pub = (await request(app).get(`/api/events/${ev.slug}`).expect(200)).body.event;
  assert.equal(pub.report.kind, 'pdf');
  assert.match((await request(app).get(up.url).expect(200)).headers['content-disposition'], /Outcome\.pdf/);
  assert.equal((await a.post('/api/admin/upload-doc/discard').send({ url: up.url }).expect(200)).body.removed, false);
  // switch to a Drive link: the old file is deleted
  await a.put(`/api/admin/events/${ev._id}`).send({ ...ev, report: { url: 'https://drive.google.com/file/d/X/view', title: 'Final report' } }).expect(200);
  await new Promise((res) => setTimeout(res, 50));
  assert.ok(!fs.existsSync(path.join(dir, up.url.split('/').pop())));
  const r2 = (await request(app).get('/api/recordings?type=report')).body.items.find((x) => x.eventUrl === `/event/${ev.slug}`);
  assert.equal(r2.title, 'Final report');
  // untick report: gone from Reports, event stays in past events
  await a.put(`/api/admin/events/${ev._id}`).send({ ...ev, report: null }).expect(200);
  assert.ok(!(await request(app).get('/api/recordings?type=report')).body.items.some((x) => x.eventUrl === `/event/${ev.slug}`));
  assert.ok((await request(app).get('/api/events?city=guwahati')).body.past.some((x) => x.slug === ev.slug));
  for (const id of [plain._id, ev._id]) await a.delete(`/api/admin/events/${id}`).expect(200);
});
