// Admin login: bcrypt password + signed session cookie (JWT, httpOnly, 12 hours).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const COOKIE = 'pcw_admin';

// JWT_SECRET from .env, otherwise a random one saved in data/ so logins survive restarts
export function loadSecret(envSecret, dataDir) {
  if (envSecret && envSecret.length >= 16 && !envSecret.startsWith('change-me')) return envSecret;
  const file = path.join(dataDir, '.jwt-secret');
  try {
    const s = fs.readFileSync(file, 'utf8').trim();
    if (s.length >= 32) return s;
  } catch {}
  const s = crypto.randomBytes(48).toString('hex');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(file, s, { mode: 0o600 });
  return s;
}

// Admin login ID + password come from server/.env (ADMIN_USERNAME, ADMIN_PASSWORD).
// Whenever those values change, the next start updates the login to match.
export async function ensureAdmin(store, username, password) {
  const admins = store.collection('admins');
  const settings = store.collection('settings');
  const user = String(username || 'admin').trim();
  const pass = String(password || 'Pcw@2026');
  const key = crypto.createHash('sha256').update(`${user}\n${pass}`).digest('hex');
  const applied = await settings.findOne({ _id: 'adminEnv' });
  const [first] = await admins.find({}, { limit: 1 });
  if (first && applied?.key === key) return { changed: false };
  const passwordHash = await bcrypt.hash(pass, 10);
  const existing = (await admins.findOne({ username: user })) || first;
  if (existing) await admins.updateOne({ _id: existing._id }, { username: user, passwordHash, updatedAt: new Date().toISOString() });
  else await admins.insertOne({ username: user, passwordHash, createdAt: new Date().toISOString() });
  await settings.updateOne({ _id: 'adminEnv' }, { key, at: new Date().toISOString() }, { upsert: true });
  return { changed: true };
}

export function makeAuth(store, secret) {
  const admins = store.collection('admins');

  async function login(req, res) {
    const { username = '', password = '' } = req.body || {};
    const admin = await admins.findOne({ username: String(username).trim() });
    const ok = admin && (await bcrypt.compare(String(password), admin.passwordHash));
    if (!ok) return res.status(401).json({ error: 'Wrong login ID or password' });
    const token = jwt.sign({ sub: admin._id }, secret, { expiresIn: '12h' });
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: req.secure, // true behind HTTPS (nginx sends X-Forwarded-Proto)
      maxAge: 12 * 3600 * 1000,
      path: '/',
    });
    res.json({ ok: true, username: admin.username });
  }

  function logout(req, res) {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  }

  async function requireAdmin(req, res, next) {
    try {
      const p = jwt.verify(req.cookies?.[COOKIE] || '', secret);
      const admin = await admins.findOne({ _id: p.sub });
      if (!admin) throw new Error('gone');
      req.admin = admin;
      next();
    } catch {
      res.status(401).json({ error: 'Please log in' });
    }
  }

  async function changePassword(req, res) {
    const { current = '', next: nw = '' } = req.body || {};
    if (!(await bcrypt.compare(String(current), req.admin.passwordHash)))
      return res.status(400).json({ error: 'Current password is wrong' });
    if (String(nw).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    await admins.updateOne({ _id: req.admin._id }, { passwordHash: await bcrypt.hash(String(nw), 10) });
    res.json({ ok: true });
  }

  return { login, logout, requireAdmin, changePassword };
}
