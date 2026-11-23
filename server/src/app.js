import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import { makeCdnCache } from './lib/cdn.js';
import { newsletterRoutes } from './routes/newsletter.js';
import { eventRoutes } from './routes/events.js';

export function createApp(store, config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));

  // ---------- API ----------
  app.get('/api/health', (req, res) => res.json({ ok: true, db: store.kind }));
  app.use('/api/newsletter', newsletterRoutes(store));
  app.use('/api', eventRoutes(store));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---------- Webflow CDN images (cached locally) ----------
  const cdn = makeCdnCache(config.cdnCache);
  app.get('/cdn/*', async (req, res) => {
    const local = await cdn(req.originalUrl.slice('/cdn/'.length).split('?')[0]);
    if (!local) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=2592000');
    res.sendFile(local);
  });

  // ---------- React website (client/dist) ----------
  const dist = config.clientDist;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use('/app', express.static(path.join(dist, 'app'), { maxAge: '1y', immutable: true }));
    app.use(express.static(dist, { maxAge: '7d', index: false }));
    app.get('*', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    app.get('/', (req, res) => res.type('text').send('API is running. Build the website first:  npm run build'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });
  return app;
}
