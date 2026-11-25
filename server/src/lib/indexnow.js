// IndexNow: tells Bing (which also feeds ChatGPT search), Yandex, Seznam and others
// right away when a page is added or changed, instead of waiting for their next crawl.
// Only runs when SITE_URL is a real public https address (never on localhost).
import crypto from 'node:crypto';

export async function indexNowKey(store) {
  const settings = store.collection('settings');
  const doc = await settings.findOne({ _id: 'indexnow' });
  if (doc?.key) return doc.key;
  const key = crypto.randomBytes(16).toString('hex');
  await settings.updateOne({ _id: 'indexnow' }, { key, createdAt: new Date().toISOString() }, { upsert: true });
  return key;
}

const isPublic = (url) => /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(url || '') && !/localhost|127\.0\.0\.1/.test(url);

// paths: ['/event/x', '/space/bangalore', ...]  -> fire and forget
export function makeIndexNow(store, config, fetchImpl = globalThis.fetch) {
  return async function ping(paths) {
    const base = config.siteUrl;
    if (!isPublic(base) || process.env.INDEXNOW === 'false' || !paths?.length) return { skipped: true };
    try {
      const key = await indexNowKey(store);
      const host = new URL(base).host;
      const urlList = [...new Set(paths)].slice(0, 100).map((p) => base + p);
      const res = await fetchImpl('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ host, key, keyLocation: `${base}/${key}.txt`, urlList }),
        signal: AbortSignal.timeout(8000),
      });
      return { status: res.status, urlList };
    } catch (e) {
      console.error('[indexnow]', e.message);
      return { error: e.message };
    }
  };
}
