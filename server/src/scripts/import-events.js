// npm run import-events -- path\to\events.csv     (or .json)
// Adds / updates events from a file made from seed/events-template.csv
// (open it in Excel, one row per event, save as CSV). Same city + date + title = updated.
// Columns: city, date (YYYY-MM-DD or DD/MM/YYYY), startTime, endTime (HH:MM, 24h), title, tagline,
//          category, venue, image (link), youtubeUrl, rsvp (open/link/closed/none), rsvpUrl (form link when rsvp=link), capacity, description
// Add --replace to delete all existing events first. (The admin panel is easier for a few events.)
// Safe options:
//   --dry-run   only show what would happen, change nothing
//   --only-new  add new events only; an event already on the site (same city + date + title) is left untouched
//               (photos, links or edits made in the admin panel are kept)
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createStore } from '../lib/store.js';
import { parseCsv } from '../lib/csv.js';
import { cleanEvent, slugify } from '../lib/events.js';

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
  const m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // 12/12/2026 (day first)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v;
};
const toTime = (v) => {
  v = String(v || '').trim();
  const m = v.match(/^(\d{1,2})[:.](\d{2})\s*(am|pm)?$/i);
  if (!m) return v;
  let h = Number(m[1]);
  if (m[3]) h = (h % 12) + (/pm/i.test(m[3]) ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${m[2]}`;
};

const DRY = process.argv.includes('--dry-run');
const ONLY_NEW = process.argv.includes('--only-new');
if (DRY && process.argv.includes('--replace')) {
  console.error('--dry-run and --replace cannot be used together.');
  process.exit(1);
}
const store = createStore(config);
await store.connect();
const events = store.collection('events');
console.log(`${rows.length} rows in ${path.basename(file)}${DRY ? '  (DRY RUN: nothing will be saved)' : ''}${ONLY_NEW ? '  (only new events)' : ''}\n`);
if (process.argv.includes('--replace')) {
  for (const e of await events.find({})) await events.deleteOne({ _id: e._id });
  console.log('Removed all existing events.');
}
let added = 0, updated = 0, skipped = 0;
for (const [i, r] of rows.entries()) {
  const { data, errors } = cleanEvent({
    ...r,
    city: String(r.city || '').toLowerCase(),
    date: toDate(r.date),
    startTime: toTime(r.startTime),
    endTime: toTime(r.endTime),
    capacity: r.capacity || null,
    rsvp: String(r.rsvp || (r.rsvpUrl ? 'link' : 'open')).toLowerCase(),
    rsvpUrl: r.rsvpUrl || '',
    published: !/^(no|false|0)$/i.test(String(r.published ?? 'yes')),
  });
  if (Object.keys(errors).length) {
    console.log(`  row ${i + 2}: skipped - ${Object.entries(errors).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    skipped++;
    continue;
  }
  const old = await events.findOne({ city: data.city, date: data.date, title: data.title });
  if (old && ONLY_NEW) {
    console.log(`  = already on the site, left as it is: ${data.date}  ${data.title}`);
    skipped++;
  } else if (old) {
    if (!DRY) await events.updateOne({ _id: old._id }, { ...data, slug: old.slug, updatedAt: new Date().toISOString() });
    console.log(`  ~ ${DRY ? 'would update' : 'updated'}: ${data.date}  ${data.title}`);
    updated++;
  } else {
    let slug = `${slugify(data.title)}-${data.date}`;
    for (let n = 2; await events.findOne({ slug }); n++) slug = `${slugify(data.title)}-${data.date}-${n}`;
    if (!DRY) await events.insertOne({ ...data, slug, sample: false, createdAt: new Date().toISOString() });
    console.log(`  + ${DRY ? 'would add' : 'added'}: ${data.date}  ${data.title}`);
    added++;
  }
}
console.log(`\n${DRY ? 'DRY RUN, nothing saved. Would be' : 'Done'}: ${added} added, ${updated} updated, ${skipped} skipped.`);
console.log(`Events on the site now: ${(await events.find({})).length}`);
await store.close();
