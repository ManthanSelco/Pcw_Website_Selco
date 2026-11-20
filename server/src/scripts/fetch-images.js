// npm run fetch-images
// Downloads every Webflow CDN image the page uses into data/cdn-cache (one time).
import fs from 'node:fs';
import path from 'node:path';
import { config, PROJECT_ROOT } from '../config.js';
import { makeCdnCache } from '../lib/cdn.js';

const get = makeCdnCache(config.cdnCache);
const roots = [path.join(PROJECT_ROOT, 'client', 'src'), path.join(PROJECT_ROOT, 'client', 'public'), path.join(PROJECT_ROOT, 'client', 'index.html')];
const files = [];
const walk = (p) => {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) fs.readdirSync(p).forEach((n) => walk(path.join(p, n)));
  else if (/\.(html|css|jsx?)$/.test(p)) files.push(p);
};
roots.forEach(walk);

const urls = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\/cdn\/([^"'\s)<>&]+)/g)) if (m[1].includes('/')) urls.add(m[1]);
let ok = 0;
for (const u of urls) {
  const r = await get(u);
  console.log(r ? '  ✓' : '  ✗', decodeURIComponent(u));
  if (r) ok++;
}
console.log(`\nSaved ${ok} of ${urls.size} images in data/cdn-cache`);
