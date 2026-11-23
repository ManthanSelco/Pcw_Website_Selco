import { config } from './config.js';
import { createStore } from './lib/store.js';
import { createApp } from './app.js';

const store = createStore(config);
try {
  await store.connect();
} catch (e) {
  console.error(`\n[pcw] Could not connect to MongoDB (${e.message}).`);
  console.error('      Check MONGODB_URI in server/.env, or leave it empty to use the local test file.\n');
  process.exit(1);
}
const app = createApp(store, config);

app.listen(config.port, () => {
  console.log(`\n PCW website: http://localhost:${config.port}`);
  console.log(` Database:    ${store.kind === 'mongo' ? 'MongoDB' : 'local test file (data/db.json) - set MONGODB_URI for MongoDB'}\n`);
});
