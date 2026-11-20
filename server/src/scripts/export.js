// npm run export -- rsvps | bookings | newsletter | events   ->  CSV file (opens in Excel)
import fs from 'node:fs';
import path from 'node:path';
import { config, PROJECT_ROOT } from '../config.js';
import { createStore } from '../lib/store.js';
import { toCsv } from '../lib/csv.js';

const COLS = {
  rsvps: ['createdAt', 'city', 'eventDate', 'eventTitle', 'name', 'email', 'phone', 'organisation', 'people'],
  bookings: ['createdAt', 'city', 'name', 'email', 'phone', 'organisation', 'purpose', 'date', 'people', 'message', 'status'],
  newsletter: ['createdAt', 'email', 'source'],
  events: ['city', 'date', 'time', 'title', 'category', 'summary', 'venue', 'image', 'recordingUrl', 'rsvpOpen'],
};
const what = process.argv[2];
if (!COLS[what]) {
  console.error(`Choose one:  npm run export -- ${Object.keys(COLS).join(' | ')}`);
  process.exit(1);
}
const store = createStore(config);
await store.connect();
const rows = await store.collection(what).find({}, { sort: { createdAt: 1 } });
const out = path.join(PROJECT_ROOT, `${what}-${new Date().toISOString().slice(0, 10)}.csv`);
fs.writeFileSync(out, toCsv(rows.map((r) => ({ ...r, rsvpOpen: r.rsvpOpen === false ? 'no' : 'yes' })), COLS[what]));
console.log(`${rows.length} rows saved to ${out}`);
await store.close();
