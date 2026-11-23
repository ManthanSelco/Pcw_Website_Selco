import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { makeCdnCache } from './lib/cdn.js';
import { newsletterRoutes } from './routes/newsletter.js';
import { eventRoutes } from './routes/events.js';
import { adminRoutes } from './routes/admin.js';
import { makeAuth } from './lib/auth.js';
import { pageFor, renderHtml, sitemapXml, robotsTxt, llmsTxt, siteUrlFor, getSite } from './lib/seo.js';

export function createApp(store, config) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(compression());
  // basic security headers (no CSP: the original Webflow scripts need inline code)
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000');
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  // ---------- API ----------
  app.get('/api/health', (req, res) => res.json({ ok: true, db: store.kind }));
  app.use('/api/newsletter', newsletterRoutes(store));
  app.use('/api', eventRoutes(store));
  app.use('/api/admin', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api/admin', adminRoutes(store, makeAuth(store, config.jwtSecret), { storage: config.storage }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  // ---------- images uploaded from the admin panel (S3 bucket or data/uploads) ----------
  if (config.storage) app.get('/uploads/:name', (req, res) => config.storage.send(req.params.name, res));

  // ---------- Webflow CDN images (cached locally) ----------
  const cdn = makeCdnCache(config.cdnCache);
  app.get('/cdn/*', async (req, res) => {
    const local = await cdn(req.originalUrl.slice('/cdn/'.length).split('?')[0]);
    if (!local) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=2592000');
    res.sendFile(local);
  });

  // ---------- SEO / AEO files ----------
  const seoText = (type, make) => async (req, res, next) => {
    try {
      res.type(type).set('Cache-Control', 'public, max-age=3600').send(await make(siteUrlFor(req, config)));
    } catch (e) {
      next(e);
    }
  };
  app.get('/sitemap.xml', seoText('application/xml', (base) => sitemapXml(store, base)));
  app.get('/robots.txt', seoText('text/plain', async (base) => robotsTxt(base)));
  app.get('/llms.txt', seoText('text/plain', (base) => llmsTxt(store, base)));

  // ---------- React website (client/dist) ----------
  const dist = config.clientDist;
  if (dist && fs.existsSync(path.join(dist, 'index.html'))) {
    app.use('/app', express.static(path.join(dist, 'app'), { maxAge: '1y', immutable: true }));
    app.use(express.static(dist, { maxAge: '7d', index: false }));
    let template = null;
    app.get('*', async (req, res, next) => {
      try {
        // every page gets its own title, description, share tags, JSON-LD and readable text
        template ||= fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
        const base = siteUrlFor(req, config);
        const [page, site] = await Promise.all([pageFor(store, req.path, base), getSite(store)]);
        if (page.redirect) return res.redirect(301, page.redirect);
        res.status(page.status).set('Cache-Control', 'no-cache');
        if (page.noindex) res.set('X-Robots-Tag', 'noindex');
        res.type('html').send(renderHtml(template, page, site));
      } catch (e) {
        next(e);
      }
    });
  } else {
    app.get('/', (req, res) => res.type('text').send('API is running. Build the website first:  npm run build'));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    if (res.headersSent) return;
    res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server' : status === 413 ? 'That is too large' : 'Bad request' });
  });
  return app;
}
