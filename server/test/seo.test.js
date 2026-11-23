import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { boot } from '../src/boot.js';

let app, store, tmp;
const TEMPLATE = '<!doctype html><html lang="en"><head><title>PCW</title><meta name="description" content="old"></head><body><div id="root"></div></body></html>';

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-seo-'));
  fs.mkdirSync(path.join(tmp, 'dist'));
  fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), TEMPLATE);
  ({ app, store } = await boot({
    jsonFile: path.join(tmp, 'db.json'),
    // TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test  -> runs the same tests on MongoDB
    mongoUri: process.env.TEST_MONGODB_URI ? `${process.env.TEST_MONGODB_URI}/pcw_test_seo_${Date.now()}` : '',
    clientDist: path.join(tmp, 'dist'),
    cdnCache: path.join(tmp, 'cdn'),
    dataDir: tmp,
    uploadDir: path.join(tmp, 'uploads'),
    adminUsername: 'admin',
    adminPassword: 'Pcw@2026',
    seedSamples: true,
    siteUrl: 'https://pcw.example.org',
  }));
  await store.collection('events').insertOne({
    slug: 'solar-for-livelihoods-2099-01-10',
    city: 'bangalore',
    title: 'Solar for Livelihoods <Talk>',
    tagline: 'A conversation on energy access',
    category: 'Talks',
    date: '2099-01-10',
    startTime: '18:00',
    endTime: '19:30',
    venue: 'PCW Space, Bengaluru',
    description: 'Long description here.',
    youtubeUrl: 'https://youtu.be/NT-gVjZCct8',
    speakers: [{ name: 'Asha Rao', role: 'Practitioner' }],
    published: true,
  });
});
after(async () => {
  await store.close?.();
  fs.rmSync(tmp, { recursive: true, force: true });
});

const ldOf = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('home: title, description, canonical, OG, JSON-LD, readable text', async () => {
  const html = (await request(app).get('/').expect(200)).text;
  assert.match(html, /<title>PCW \| Platform for Collective Wisdom by SELCO Foundation<\/title>/);
  assert.equal((html.match(/<meta name="description"/g) || []).length, 1);
  assert.match(html, /<link rel="canonical" href="https:\/\/pcw\.example\.org\/">/);
  assert.match(html, /og:image" content="https:\/\/pcw\.example\.org\/assets\//);
  const ld = ldOf(html)['@graph'];
  assert.ok(ld.some((x) => x['@type'] === 'Organization' && x.email === 'contact@thepcw.ai'));
  assert.match(html, /<div id="root"><div class="pcw-ssr">[\s\S]*What is the PCW\?/);
  assert.match(html, /Solar for Livelihoods &lt;Talk&gt;/); // upcoming real event listed, escaped
  assert.doesNotMatch(html, /<Talk>/);
});

test('event page: Event schema with IST time, place, performer, recording', async () => {
  const res = await request(app).get('/event/solar-for-livelihoods-2099-01-10').expect(200);
  assert.match(res.text, /<title>Solar for Livelihoods &lt;Talk&gt; \| PCW Bangalore<\/title>/);
  assert.match(res.text, /content="index, follow/);
  const ev = ldOf(res.text)['@graph'].find((x) => x['@type'] === 'Event');
  assert.equal(ev.startDate, '2099-01-10T18:00:00+05:30');
  assert.equal(ev.endDate, '2099-01-10T19:30:00+05:30');
  assert.equal(ev.location.address.postalCode, '560078');
  assert.equal(ev.performer[0].name, 'Asha Rao');
  assert.equal(ev.recordedIn['@type'], 'VideoObject');
  assert.ok(!res.text.includes('<Talk>')); // JSON-LD escaped too
});

test('sample events are noindex; unknown pages are 404 noindex', async () => {
  const sample = (await store.collection('events').find({ sample: true }))[0];
  const res = await request(app).get(`/event/${sample.slug}`).expect(200);
  assert.match(res.text, /noindex/);
  assert.equal(res.headers['x-robots-tag'], 'noindex');
  const nf = await request(app).get('/event/does-not-exist').expect(404);
  assert.match(nf.text, /Page not found/);
  await request(app).get('/space/delhi').expect(404);
  await request(app).get('/no/such/page').expect(404);
  assert.match((await request(app).get('/admin').expect(200)).text, /noindex/);
});

test('city, recordings and policy pages', async () => {
  const city = (await request(app).get('/space/bangalore').expect(200)).text;
  assert.match(city, /<title>PCW Bangalore: Events/);
  assert.match(city, /href="\/event\/solar-for-livelihoods-2099-01-10"/);
  assert.ok(ldOf(city)['@graph'].some((x) => x['@type'] === 'ItemList'));
  assert.match((await request(app).get('/recordings').expect(200)).text, /recordings\/podcasts" ?>|canonical" href="https:\/\/pcw\.example\.org\/recordings\/podcasts"/);
  const vids = (await request(app).get('/recordings/videos').expect(200)).text;
  assert.ok(ldOf(vids)['@graph'].some((x) => x['@type'] === 'ItemList'));
  const priv = (await request(app).get('/privacy-policy').expect(200)).text;
  assert.match(priv, /Information We Collect/);
  const contact = (await request(app).get('/contact-us').expect(200)).text;
  assert.ok(ldOf(contact)['@graph'].some((x) => x['@type'] === 'ContactPage'));
});

test('sitemap.xml, robots.txt, llms.txt', async () => {
  const sm = (await request(app).get('/sitemap.xml').expect(200).expect('content-type', /xml/)).text;
  assert.match(sm, /<loc>https:\/\/pcw\.example\.org\/event\/solar-for-livelihoods-2099-01-10<\/loc>/);
  const sample = (await store.collection('events').find({ sample: true }))[0];
  assert.ok(!sm.includes(sample.slug)); // samples left out
  const robots = (await request(app).get('/robots.txt').expect(200)).text;
  assert.match(robots, /User-agent: GPTBot\nAllow: \//);
  assert.match(robots, /Disallow: \/admin/);
  assert.match(robots, /Sitemap: https:\/\/pcw\.example\.org\/sitemap\.xml/);
  const llms = (await request(app).get('/llms.txt').expect(200)).text;
  assert.match(llms, /^# Platform for Collective Wisdom \(PCW\)/);
  assert.match(llms, /\[Solar for Livelihoods <Talk>\]\(https:\/\/pcw\.example\.org\/event\//);
});

test('admin: Google / Bing verification codes', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(200);
  await a.put('/api/admin/site').send({ googleVerification: '<meta name="google-site-verification" content="abc_DEF-123" />', bingVerification: 'B1NG' }).expect(200);
  const html = (await request(app).get('/').expect(200)).text;
  assert.match(html, /<meta name="google-site-verification" content="abc_DEF-123">/);
  assert.match(html, /<meta name="msvalidate.01" content="B1NG">/);
  await a.put('/api/admin/site').send({ googleVerification: '"><script>' }).expect(400);
});
