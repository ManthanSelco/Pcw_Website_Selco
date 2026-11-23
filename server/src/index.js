import { config } from './config.js';
import { boot } from './boot.js';

let started;
try {
  started = await boot(config);
} catch (e) {
  console.error(`\n[pcw] Could not start: ${e.message}`);
  console.error('      If this is a MongoDB error, check MONGODB_URI in server/.env (or leave it empty to use the local test file).\n');
  process.exit(1);
}
const { store, app, seeded, storage, storageWarning } = started;
const server = app.listen(config.port, () => {
  console.log(`\n PCW website: http://localhost:${config.port}`);
  console.log(` Admin panel: http://localhost:${config.port}/admin`);
  console.log(`   Login ID:  ${config.adminUsername}   Password: as set in server/.env (ADMIN_PASSWORD)`);
  console.log(` Database:    ${store.kind === 'mongo' ? 'MongoDB' : 'local test file (data/db.json) - set MONGODB_URI for MongoDB'}`);
  console.log(` Images:      ${storage.kind === 's3' ? `S3 bucket "${storage.bucket}"` : 'local folder (data/uploads) - set S3_BUCKET to use S3'}`);
  if (storageWarning) console.log(`\n WARNING: ${storageWarning}`);
  if (seeded) console.log(` Added ${seeded} sample events (delete them any time from Admin > Events).`);
  if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'Pcw@2026'))
    console.log('\n WARNING: the admin password is the default one. Set ADMIN_PASSWORD in server/.env and restart.');
  if (process.env.NODE_ENV === 'production' && !config.siteUrl) console.log(' WARNING: SITE_URL is empty in server/.env (needed for Google / sitemap links).');
  console.log('');
});

// stop cleanly on restart (systemctl restart / Ctrl+C)
for (const sig of ['SIGTERM', 'SIGINT'])
  process.on(sig, () => {
    server.close(() => store.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  });
