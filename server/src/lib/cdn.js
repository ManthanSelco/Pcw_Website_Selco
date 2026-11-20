// Images the page loads from Webflow's CDN (partner logos, favicon, newsletter frame…).
// They are downloaded once into data/cdn-cache and served from there afterwards,
// so the site keeps working even if the Webflow site is removed.
import fs from 'node:fs';
import path from 'node:path';

const CDN = 'https://cdn.prod.website-files.com';
const inflight = new Map();

export function makeCdnCache(cacheDir) {
  return async function get(rel) {
    const clean = path.posix.normalize('/' + rel).slice(1);
    if (!clean || clean.includes('..')) return null;
    let decoded;
    try {
      decoded = decodeURIComponent(clean);
    } catch {
      return null;
    }
    const local = path.join(cacheDir, decoded);
    if (!local.startsWith(cacheDir + path.sep)) return null;
    if (fs.existsSync(local)) return local;
    if (!inflight.has(local)) {
      inflight.set(
        local,
        (async () => {
          try {
            const r = await fetch(`${CDN}/${clean}`, { signal: AbortSignal.timeout(20000) });
            if (!r.ok) return null;
            const buf = Buffer.from(await r.arrayBuffer());
            fs.mkdirSync(path.dirname(local), { recursive: true });
            fs.writeFileSync(local + '.tmp', buf);
            fs.renameSync(local + '.tmp', local);
            return local;
          } catch {
            return null;
          } finally {
            inflight.delete(local);
          }
        })()
      );
    }
    return inflight.get(local);
  };
}
