import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { createStore } from '../src/lib/store.js';
import { createApp } from '../src/app.js';

let app, tmp, store;
before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-'));
  store = createStore({ jsonFile: path.join(tmp, 'db.json') });
  await store.connect();
  fs.mkdirSync(path.join(tmp, 'dist'));
  fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), '<html>PCW</html>');
  app = createApp(store, { clientDist: path.join(tmp, 'dist'), cdnCache: path.join(tmp, 'cdn') });
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('health', async () => {
  const r = await request(app).get('/api/health').expect(200);
  assert.equal(r.body.db, 'json');
});

test('newsletter saves, lowercases and ignores duplicates', async () => {
  await request(app).post('/api/newsletter').send({ email: 'Asha@Example.org' }).expect(200);
  await request(app).post('/api/newsletter').send({ email: 'asha@example.org' }).expect(200);
  assert.equal(await store.collection('newsletter').count(), 1);
  assert.equal((await store.collection('newsletter').findOne({})).email, 'asha@example.org');
});

test('newsletter rejects bad emails', async () => {
  await request(app).post('/api/newsletter').send({ email: 'nope' }).expect(400);
  await request(app).post('/api/newsletter').send({}).expect(400);
});

test('website routes fall back to index.html, unknown API is 404', async () => {
  const r = await request(app).get('/some/page').expect(200);
  assert.match(r.text, /PCW/);
  await request(app).get('/api/unknown').expect(404);
});

test('cdn path traversal is refused', async () => {
  await request(app).get('/cdn/..%2F..%2Fetc/passwd').expect(404);
});

test('events: split upcoming/past, RSVP and bookings', async () => {
  const ev = store.collection('events');
  const fut = new Date(Date.now() + 864e5 * 20).toISOString().slice(0, 10);
  const up = await ev.insertOne({ city: 'bangalore', title: 'Future talk', date: fut, category: 'Talk' });
  await ev.insertOne({ city: 'bangalore', title: 'Old talk', date: '2025-01-01', recordingUrl: 'https://youtu.be/x' });
  await ev.insertOne({ city: 'guwahati', title: 'GHY meet', date: fut });
  await ev.insertOne({ city: 'bangalore', title: 'Hidden', date: fut, published: false });

  const b = (await request(app).get('/api/events?city=bangalore').expect(200)).body;
  assert.deepEqual(b.upcoming.map((e) => e.title), ['Future talk']);
  assert.deepEqual(b.past.map((e) => e.title), ['Old talk']);
  await request(app).get('/api/events?city=delhi').expect(404);
  const rec = (await request(app).get('/api/events?recordings=1').expect(200)).body;
  assert.deepEqual(rec.recordings.map((e) => e.title), ['Old talk']);

  await request(app).post('/api/rsvp').send({ eventId: up._id, name: 'Ravi', email: 'RAVI@x.org' }).expect(200);
  await request(app).post('/api/rsvp').send({ eventId: up._id, name: 'Ravi', email: 'ravi@x.org' }).expect(200);
  assert.equal(await store.collection('rsvps').count(), 1);
  const past = b.past[0];
  await request(app).post('/api/rsvp').send({ eventId: past.id, name: 'A', email: 'a@b.co' }).expect(400);
  await request(app).post('/api/rsvp').send({ eventId: 'nope', name: 'A', email: 'a@b.co' }).expect(400);
  const bad = await request(app).post('/api/rsvp').send({ eventId: up._id, email: 'x' }).expect(400);
  assert.ok(bad.body.errors.name && bad.body.errors.email);

  await request(app).post('/api/bookings').send({ city: 'guwahati', name: 'Mina', email: 'm@x.org', phone: '9876543210', purpose: 'Host an event', date: fut, people: '30' }).expect(200);
  const bb = await request(app).post('/api/bookings').send({ city: 'guwahati', name: 'Mina', email: 'm@x.org', phone: '98', purpose: 'x', date: '2020-01-01' }).expect(400);
  assert.ok(bb.body.errors.phone && bb.body.errors.purpose && bb.body.errors.date);
  assert.equal(await store.collection('bookings').count(), 1);
});
