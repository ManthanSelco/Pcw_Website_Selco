import { Router } from 'express';
import rateLimit from 'express-rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function newsletterRoutes(store) {
  const subscribers = store.collection('newsletter');
  const r = Router();

  r.post(
    '/',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }),
    async (req, res, next) => {
      try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email) || email.length > 160) return res.status(400).json({ error: 'Please enter a valid email address.' });
        const exists = await subscribers.findOne({ email });
        if (!exists) {
          await subscribers.insertOne({
            email,
            source: String(req.body?.source || 'website').slice(0, 60),
            createdAt: new Date().toISOString(),
          });
        }
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    }
  );
  return r;
}
