// npm run import-events -- path\to\events.csv     (or .json)
// Adds / updates events from a file made from seed/events-template.csv (open it in Excel,
// fill one row per event, save as CSV). Same city + date + title = updated, not duplicated.
// Columns: city (bangalore|guwahati), date (YYYY-MM-DD), time, title, category, summary,
//          venue, image (link), recordingUrl (YouTube etc), rsvpOpen (yes/no)
// Add --replace to delete all existing events first.
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createStore } from '../lib/store.js';
import { parseCsv } from '../lib/csv.js';
import { CITIES } from '../lib/cities.js';

const arg = process.argv.find((a, i) => i > 1 && !a.startsWith('--'));
// npm runs this inside server/, so resolve the path from where the command was typed
const file = arg && path.resolve(process.env.INIT_CWD || process.cwd(), arg);
if (!file || !fs.existsSync(file)) {
  console.error('Give the file:  npm run import-events -- D:\\PCW\\events.csv');
  process.exit(1);
}
const raw = fs.readFileSync(file, 'utf8');
const rows = file.toLowerCase().endsWith('.json') ? JSON.parse(raw) : parseCsv(raw);

const toDate = (v) => {
  v = String(v || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // 12/12/2026 (day first, Indian format)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
const yes = (v) => !/^(no|n|false|0|closed)$/i.test(String(v ?? 'yes').trim());

const store = createStore(config);
await store.connect();
const events = store.collection('events');
if (process.argv.includes('--replace')) {
  for (const e of await events.find({})) await events.deleteOne({ _id: e._id });
  console.log('Removed all existing events.');
}
let added = 0, updated = 0, skipped = 0;
for (const [i, r] of rows.entries()) {
  const city = String(r.city || '').trim().toLowerCase();
  const ev = {
    city,
    date: toDate(r.date),
    time: String(r.time || '').trim(),
    title: String(r.title || '').trim(),
    category: String(r.category || '').trim(),
    summary: String(r.summary || '').trim(),
    venue: String(r.venue || '').trim(),
    image: String(r.image || '').trim(),
    recordingUrl: String(r.recordingUrl || '').trim(),
    rsvpOpen: yes(r.rsvpOpen),
    published: yes(r.published),
  };
  if (!CITIES[city] || !ev.title) {
    console.log(`  row ${i + 2}: skipped (city must be ${Object.keys(CITIES).join('/')}, title needed)`);
    skipped++;
    continue;
  }
  if (r.date && !ev.date) {
    console.log(`  row ${i + 2}: skipped (date "${r.date}" - use YYYY-MM-DD or DD/MM/YYYY)`);
    skipped++;
    continue;
  }
  const old = await events.findOne({ city, date: ev.date, title: ev.title });
  if (old) {
    await events.updateOne({ _id: old._id }, { ...ev, updatedAt: new Date().toISOString() });
    updated++;
  } else {
    await events.insertOne({ ...ev, createdAt: new Date().toISOString() });
    added++;
  }
}
console.log(`\nDone: ${added} added, ${updated} updated, ${skipped} skipped.`);
await store.close();
