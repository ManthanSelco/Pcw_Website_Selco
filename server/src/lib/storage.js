// Where admin-uploaded images live.
//  - S3 (when S3_BUCKET is set)  -> saved in the bucket, deleted from the bucket
//  - local disk (data/uploads)   -> when S3 is not configured (laptop testing)
//
// The website always uses /uploads/<file>.webp links. With S3 the server streams the
// image from the bucket, so the bucket can stay PRIVATE (no public access needed).
// If you put CloudFront / a public URL in S3_PUBLIC_URL, images are linked there directly.
import fs from 'node:fs';
import path from 'node:path';

const NAME_RE = /^[a-f0-9-]{36}\.webp$/;
// uploaded reports: PDF, Word, PowerPoint (served at /files/<name>)
export const DOC_RE = /^[a-f0-9-]{36}\.(pdf|doc|docx|ppt|pptx)$/;
export const DOC_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
export const docNameFromUrl = (url) => {
  const m = String(url || '').match(/^\/files\/([a-f0-9-]{36}\.(?:pdf|doc|docx|ppt|pptx))$/);
  return m ? m[1] : '';
};
const disposition = (name, filename) => {
  const ext = name.split('.').pop();
  const safe = String(filename || `report.${ext}`).replace(/[\r\n"\\]/g, '').slice(0, 150);
  return `${ext === 'pdf' ? 'inline' : 'attachment'}; filename="${safe.replace(/[^\x20-\x7e]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
};

function localStorage(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const docsDir = path.join(dir, 'files');
  fs.mkdirSync(docsDir, { recursive: true });
  return {
    kind: 'local',
    async saveDoc(name, buffer) {
      fs.writeFileSync(path.join(docsDir, name), buffer);
      return '/files/' + name;
    },
    async removeDoc(url) {
      const name = docNameFromUrl(url);
      if (name) fs.rmSync(path.join(docsDir, name), { force: true });
    },
    async sendDoc(name, res, filename) {
      const p = path.join(docsDir, name);
      if (!DOC_RE.test(name) || !fs.existsSync(p)) return res.status(404).end();
      res.set({ 'Content-Type': DOC_TYPES[name.split('.').pop()], 'Content-Disposition': disposition(name, filename), 'Cache-Control': 'public, max-age=86400' });
      res.sendFile(p, { headers: { 'Content-Type': DOC_TYPES[name.split('.').pop()] } });
    },
    async save(name, buffer) {
      fs.writeFileSync(path.join(dir, name), buffer);
      return '/uploads/' + name;
    },
    async remove(url) {
      const name = nameFromUrl(url);
      if (name) fs.rmSync(path.join(dir, name), { force: true });
    },
    async send(name, res) {
      const p = path.join(dir, name);
      if (!NAME_RE.test(name) || !fs.existsSync(p)) return res.status(404).end();
      res.set('Cache-Control', 'public, max-age=2592000, immutable');
      res.sendFile(p);
    },
    async exists(url) {
      const name = nameFromUrl(url);
      return !!name && fs.existsSync(path.join(dir, name));
    },
  };
}

async function s3Storage(cfg) {
  const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const client = new S3Client({
    region: cfg.region,
    // Credentials: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from .env, or the EC2 IAM role automatically
    ...(cfg.endpoint ? { endpoint: cfg.endpoint, forcePathStyle: true } : {}),
  });
  const prefix = cfg.prefix ? cfg.prefix.replace(/^\/+|\/+$/g, '') + '/' : '';
  const key = (name) => prefix + name;
  // documents go in their own folder (e.g. project/documents/pcw/)
  const docsPrefix = (cfg.docsPrefix ?? 'project/documents/pcw').replace(/^\/+|\/+$/g, '') + '/';
  const docKey = (name) => docsPrefix + name;
  const publicBase = (cfg.publicUrl || '').replace(/\/+$/, '');

  return {
    kind: 's3',
    bucket: cfg.bucket,
    async saveDoc(name, buffer) {
      await client.send(
        new PutObjectCommand({ Bucket: cfg.bucket, Key: docKey(name), Body: buffer, ContentType: DOC_TYPES[name.split('.').pop()] })
      );
      return '/files/' + name;
    },
    async removeDoc(url) {
      const name = docNameFromUrl(url);
      if (name) await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: docKey(name) }));
    },
    async sendDoc(name, res, filename) {
      if (!DOC_RE.test(name)) return res.status(404).end();
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: docKey(name) }));
        res.set({ 'Content-Type': DOC_TYPES[name.split('.').pop()], 'Content-Disposition': disposition(name, filename), 'Cache-Control': 'public, max-age=86400' });
        if (out.ContentLength) res.set('Content-Length', String(out.ContentLength));
        out.Body.pipe(res);
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return res.status(404).end();
        console.error('[s3] document read failed:', e.message);
        res.status(502).end();
      }
    },
    async save(name, buffer) {
      await client.send(
        new PutObjectCommand({
          Bucket: cfg.bucket,
          Key: key(name),
          Body: buffer,
          ContentType: 'image/webp',
          CacheControl: 'public, max-age=31536000, immutable',
        })
      );
      return publicBase ? `${publicBase}/${key(name)}` : '/uploads/' + name;
    },
    async remove(url) {
      const name = nameFromUrl(url, publicBase);
      if (!name) return;
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key(name) }));
    },
    async send(name, res) {
      if (!NAME_RE.test(name)) return res.status(404).end();
      try {
        const out = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key(name) }));
        res.set('Content-Type', out.ContentType || 'image/webp');
        if (out.ContentLength) res.set('Content-Length', String(out.ContentLength));
        res.set('Cache-Control', 'public, max-age=2592000, immutable');
        out.Body.pipe(res);
      } catch (e) {
        if (e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404) return res.status(404).end();
        console.error('[s3] read failed:', e.message);
        res.status(502).end();
      }
    },
    async exists(url) {
      const name = nameFromUrl(url, publicBase);
      if (!name) return false;
      try {
        await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: key(name) }));
        return true;
      } catch {
        return false;
      }
    },
    async check() {
      // write, read and delete one small test file (always the same name, so nothing piles up)
      // so a wrong bucket or missing permission shows at start-up. Returns notes for missing extras.
      const probe = `${prefix}.pcw-check`;
      await client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: probe, Body: 'ok', ContentType: 'text/plain' }));
      await client.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: probe }));
      try {
        await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: probe }));
        return { canDelete: true };
      } catch (e) {
        if (e?.name === 'AccessDenied' || e?.$metadata?.httpStatusCode === 403) return { canDelete: false };
        throw e;
      }
    },
  };
}

// "/uploads/<name>.webp" or "<S3_PUBLIC_URL>/<prefix>/<name>.webp" -> "<name>.webp"
export function nameFromUrl(url, publicBase = '') {
  const s = String(url || '');
  let name = '';
  if (s.startsWith('/uploads/')) name = s.slice('/uploads/'.length);
  else if (publicBase && s.startsWith(publicBase + '/')) name = s.split('/').pop();
  return NAME_RE.test(name) ? name : '';
}

export async function createStorage(config) {
  if (config.s3?.bucket) return s3Storage(config.s3);
  return localStorage(config.uploadDir);
}
