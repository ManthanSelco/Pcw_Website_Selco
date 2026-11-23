// Shared start-up: database, first admin, secret, sample events
import { createStore } from './lib/store.js';
import { ensureAdmin, loadSecret } from './lib/auth.js';
import { seedSamples } from './lib/samples.js';
import { seedRecordings } from './lib/recordings.js';
import { createApp } from './app.js';
import { createStorage } from './lib/storage.js';

export async function boot(config) {
  const store = createStore(config);
  await store.connect();
  await ensureAdmin(store, config.adminUsername, config.adminPassword);
  const jwtSecret = loadSecret(config.jwtSecretEnv, config.dataDir);
  const seeded = config.seedSamples ? await seedSamples(store) : 0;
  if (config.seedSamples) await seedRecordings(store);
  const storage = await createStorage(config);
  let storageWarning = '';
  if (storage.check) {
    try {
      await storage.check();
    } catch (e) {
      storageWarning = `S3 bucket "${config.s3.bucket}" is not reachable (${e.name || e.message}). Image uploads will fail until S3 settings are fixed.`;
    }
  }
  const app = createApp(store, { ...config, jwtSecret, storage });
  return { store, app, seeded, storage, storageWarning };
}
