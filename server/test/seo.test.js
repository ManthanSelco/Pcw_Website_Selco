import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { boot } from '../src/boot.js';

let app, store, tmp;
const pings = [];
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
    indexNow: async (paths) => pings.push(paths),
    indexNowDelayMs: 0,
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

test('FAQ page: default answers, FAQPage data, llms.txt, admin edit', async () => {
  const html = (await request(app).get('/faq').set('Host', 'pcw.example.org').expect(200)).text;
  assert.match(html, /<title>FAQ: Platform for Collective Wisdom \(PCW\)<\/title>/);
  const faqLd = ldOf(html)['@graph'].find((x) => x['@type'] === 'FAQPage');
  assert.ok(faqLd.mainEntity.length >= 8);
  assert.equal(faqLd.mainEntity[0]['@type'], 'Question');
  assert.match((await request(app).get('/llms.txt').set('Host', 'pcw.example.org')).text, /## Frequently asked questions\n### What is the Platform for Collective Wisdom/);
  assert.match((await request(app).get('/sitemap.xml').set('Host', 'pcw.example.org')).text, /<loc>https:\/\/pcw\.example\.org\/faq<\/loc>/);

  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(200);
  await a.put('/api/admin/faq').send({ items: [{ q: 'Only question?', a: '' }] }).expect(400);
  await a.put('/api/admin/faq').send({ items: [{ q: 'Is it <b>free</b>?', a: 'Yes.' }, { q: '', a: '' }] }).expect(200);
  assert.deepEqual((await request(app).get('/api/faq').expect(200)).body.items, [{ q: 'Is it <b>free</b>?', a: 'Yes.' }]);
  const after = (await request(app).get('/faq').set('Host', 'pcw.example.org')).text;
  assert.match(after, /Is it &lt;b&gt;free&lt;\/b&gt;\?/);
  assert.ok(!after.includes('<b>free</b>'));
});

test('official profiles (sameAs) go into Organization data and llms.txt', async () => {
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(200);
  await a.put('/api/admin/site').send({ sameAs: 'http://insecure.example' }).expect(400);
  await a.put('/api/admin/site').send({ sameAs: 'https://www.linkedin.com/company/pcw\nhttps://www.youtube.com/@pcw' }).expect(200);
  const org = ldOf((await request(app).get('/').set('Host', 'pcw.example.org')).text)['@graph'].find((x) => x['@type'] === 'Organization');
  assert.deepEqual(org.sameAs, ['https://www.linkedin.com/company/pcw', 'https://www.youtube.com/@pcw']);
  assert.match((await request(app).get('/llms.txt').set('Host', 'pcw.example.org')).text, /Official profiles: https:\/\/www\.linkedin\.com\/company\/pcw/);
});

test('one main address: other names redirect (301), API and internal checks do not', async () => {
  const r = await request(app).get('/space/bangalore?x=1').set('Host', 'www.pcw.example.org').expect(301);
  assert.equal(r.headers.location, 'https://pcw.example.org/space/bangalore?x=1');
  await request(app).get('/').set('Host', 'pcw.3-108-88-152.sslip.io').expect(301);
  await request(app).get('/').set('Host', 'pcw.example.org').expect(200);
  await request(app).get('/api/health').set('Host', 'www.pcw.example.org').expect(200);
  await request(app).get('/').set('Host', '127.0.0.1:4100').expect(200);
});

test('IndexNow: key file served, changes are announced', async () => {
  const { indexNowKey } = await import('../src/lib/indexnow.js');
  const key = await indexNowKey(store);
  assert.equal((await request(app).get(`/${key}.txt`).set('Host', 'pcw.example.org').expect(200)).text, key);
  await request(app).get(`/${'0'.repeat(32)}.txt`).set('Host', 'pcw.example.org').expect(404);
  const a = request.agent(app);
  await a.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(200);
  pings.length = 0;
  await a.post('/api/admin/events').send({ city: 'guwahati', title: 'IndexNow Test', date: '2099-05-05', rsvp: 'none' }).expect(200);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(pings.length, 1);
  assert.ok(pings[0].includes('/space/guwahati') && pings[0].includes('/event/indexnow-test-2099-05-05'));

  const { makeIndexNow } = await import('../src/lib/indexnow.js');
  const calls = [];
  const fake = async (url, opts) => (calls.push([url, JSON.parse(opts.body)]), { status: 202 });
  assert.deepEqual(await makeIndexNow(store, { siteUrl: 'http://localhost:4000' }, fake)(['/']), { skipped: true });
  const out = await makeIndexNow(store, { siteUrl: 'https://pcw.example.org' }, fake)(['/', '/faq', '/']);
  assert.equal(out.status, 202);
  assert.equal(calls[0][0], 'https://api.indexnow.org/indexnow');
  assert.deepEqual(calls[0][1].urlList, ['https://pcw.example.org/', 'https://pcw.example.org/faq']);
  assert.equal(calls[0][1].keyLocation, `https://pcw.example.org/${key}.txt`);
});
