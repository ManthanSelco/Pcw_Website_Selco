// Runs only when S3_TEST_ENDPOINT points to an S3-compatible test server (e.g. moto / MinIO):
//   S3_TEST_ENDPOINT=http://127.0.0.1:5005 npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import sharp from 'sharp';
import { S3Client, CreateBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { boot } from '../src/boot.js';

const EP = process.env.S3_TEST_ENDPOINT;
const BUCKET = 'pcw-test-bucket';
let app, tmp, agent, s3;

const listKeys = async () => ((await s3.send(new ListObjectsV2Command({ Bucket: BUCKET }))).Contents || []).map((o) => o.Key);

before(async () => {
  if (!EP) return;
  process.env.AWS_ACCESS_KEY_ID ||= 'test';
  process.env.AWS_SECRET_ACCESS_KEY ||= 'test';
  s3 = new S3Client({ region: 'ap-south-1', endpoint: EP, forcePathStyle: true });
  await s3.send(new CreateBucketCommand({ Bucket: BUCKET, CreateBucketConfiguration: { LocationConstraint: 'ap-south-1' } })).catch(() => {});
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcw-s3-'));
  fs.mkdirSync(path.join(tmp, 'dist'));
  fs.writeFileSync(path.join(tmp, 'dist', 'index.html'), '<html>PCW</html>');
  ({ app } = await boot({
    jsonFile: path.join(tmp, 'db.json'),
    clientDist: path.join(tmp, 'dist'),
    cdnCache: path.join(tmp, 'cdn'),
    dataDir: tmp,
    uploadDir: path.join(tmp, 'uploads'),
    adminUsername: 'admin',
    adminPassword: 'Pcw@2026',
    seedSamples: false,
    s3: { bucket: BUCKET, region: 'ap-south-1', prefix: 'project/images/pcw', endpoint: EP },
  }));
  agent = request.agent(app);
  await agent.post('/api/admin/login').send({ username: 'admin', password: 'Pcw@2026' }).expect(200);
});
after(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

test('S3: upload saves to bucket, served via /uploads, replaced + deleted images are removed', { skip: !EP && 'set S3_TEST_ENDPOINT' }, async () => {
  const img = (c) => sharp({ create: { width: 80, height: 60, channels: 3, background: c } }).png().toBuffer();
  const a = (await agent.post('/api/admin/upload').attach('image', await img('#f60'), 'a.png').expect(200)).body;
  assert.equal(a.storage, 's3');
  assert.match(a.url, /^\/uploads\/[a-f0-9-]{36}\.webp$/);
  const name = a.url.split('/').pop();
  assert.deepEqual(await listKeys(), [`project/images/pcw/${name}`]);
  const got = await request(app).get(a.url).expect(200);
  assert.equal(got.headers['content-type'], 'image/webp');
  assert.ok(got.body.length > 20);
  assert.equal(fs.existsSync(path.join(tmp, 'uploads', name)), false); // nothing on local disk

  const date = new Date(Date.now() + 864e5 * 9).toISOString().slice(0, 10);
  const ev = (await agent.post('/api/admin/events').send({ city: 'bangalore', title: 'S3 Event', date, image: a.url }).expect(200)).body;

  // replace photo -> old object deleted
  const b = (await agent.post('/api/admin/upload').attach('image', await img('#06f'), 'b.png').expect(200)).body;
  await agent.put(`/api/admin/events/${ev._id}`).send({ ...ev, image: b.url }).expect(200);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await listKeys(), [`project/images/pcw/${b.url.split('/').pop()}`]);
  await request(app).get(a.url).expect(404);

  // uploaded but cancelled -> discard removes it; an image in use is kept
  const c = (await agent.post('/api/admin/upload').attach('image', await img('#0a0'), 'c.png').expect(200)).body;
  assert.equal((await agent.post('/api/admin/upload/discard').send({ url: c.url }).expect(200)).body.removed, true);
  assert.equal((await agent.post('/api/admin/upload/discard').send({ url: b.url }).expect(200)).body.removed, false);

  // delete event -> its image is deleted from the bucket
  await agent.delete(`/api/admin/events/${ev._id}`).expect(200);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await listKeys(), []);
  await request(app).get('/uploads/..%2F..%2Fetc%2Fpasswd').expect(404);

  // city space photo: saved in S3, replaced photo deleted from S3
  const sp = (await agent.get('/api/admin/spaces').expect(200)).body.spaces.find((x) => x.city === 'guwahati');
  const p1 = (await agent.post('/api/admin/upload').attach('image', await img('#123456'), 'p1.png').expect(200)).body.url;
  sp.cards[1].image = p1;
  await agent.put('/api/admin/spaces/guwahati').send(sp).expect(200);
  assert.deepEqual(await listKeys(), [`project/images/pcw/${p1.split('/').pop()}`]);
  const p2 = (await agent.post('/api/admin/upload').attach('image', await img('#654321'), 'p2.png').expect(200)).body.url;
  sp.cards[1].image = p2;
  await agent.put('/api/admin/spaces/guwahati').send(sp).expect(200);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await listKeys(), [`project/images/pcw/${p2.split('/').pop()}`]);
  sp.cards[1].image = '';
  await agent.put('/api/admin/spaces/guwahati').send(sp).expect(200);
  await new Promise((r) => setTimeout(r, 200));
  assert.deepEqual(await listKeys(), []);
  await request(app).get('/uploads/not-an-image.txt').expect(404);
});

test('S3: uploaded reports go to project/documents/pcw, are served and removed', { skip: !EP && 'set S3_TEST_ENDPOINT' }, async () => {
  const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(500, 0x20)]);
  const up = (await agent.post('/api/admin/upload-doc').attach('file', pdf, 'Field Report.pdf').expect(200)).body;
  const name = up.url.split('/').pop();
  assert.ok((await listKeys()).includes(`project/documents/pcw/${name}`));
  assert.equal(fs.existsSync(path.join(tmp, 'uploads', 'files', name)), false); // nothing on local disk
  const rec = (await agent.post('/api/admin/recordings').send({ type: 'report', title: 'Field Report', link: up.url, fileName: up.name, fileSize: up.size }).expect(200)).body;
  const got = await request(app).get(up.url).expect(200);
  assert.equal(got.headers['content-type'], 'application/pdf');
  assert.equal(Buffer.from(got.body).subarray(0, 5).toString(), '%PDF-');
  await agent.delete(`/api/admin/recordings/${rec._id}`).expect(200);
  await new Promise((r) => setTimeout(r, 200));
  assert.ok(!(await listKeys()).includes(`project/documents/pcw/${name}`));
});
