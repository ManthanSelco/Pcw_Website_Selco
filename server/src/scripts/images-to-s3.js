// npm run images-to-s3
// One-time move: copies images already in data/uploads (uploaded before S3 was set up)
// into the S3 bucket. Links on the website stay the same (/uploads/<file>).
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createStorage } from '../lib/storage.js';

if (!config.s3.bucket) {
  console.error('Set S3_BUCKET (and S3_REGION) in server/.env first.');
  process.exit(1);
}
const storage = await createStorage(config);
await storage.check();
const files = fs.existsSync(config.uploadDir) ? fs.readdirSync(config.uploadDir).filter((f) => f.endsWith('.webp')) : [];
let n = 0;
for (const f of files) {
  if (await storage.exists('/uploads/' + f)) continue;
  await storage.save(f, fs.readFileSync(path.join(config.uploadDir, f)));
  console.log('  uploaded', f);
  n++;
}
console.log(`\nDone: ${n} image(s) copied to S3 bucket "${config.s3.bucket}". (${files.length - n} were already there.)`);
console.log('You can delete the data/uploads folder after checking the website.');
