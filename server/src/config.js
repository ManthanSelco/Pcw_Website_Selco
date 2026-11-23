import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

const envFile = path.join(SERVER_ROOT, '.env');
if (!fs.existsSync(envFile) && fs.existsSync(path.join(SERVER_ROOT, '.env.example')) && !process.env.PCW_NO_ENV_FILE) {
  fs.copyFileSync(path.join(SERVER_ROOT, '.env.example'), envFile); // first run: create server/.env
}
dotenv.config({ path: envFile });

export const config = {
  port: Number(process.env.PORT) || 4000,
  // Public address of the website, used in Google/sitemap links, e.g. https://thepcw.ai (empty = taken from the request)
  siteUrl: (process.env.SITE_URL || '').trim().replace(/\/+$/, ''),
  mongoUri: process.env.MONGODB_URI || '',
  jsonFile: path.join(PROJECT_ROOT, 'data', 'db.json'),
  clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
  cdnCache: path.join(PROJECT_ROOT, 'data', 'cdn-cache'),
  dataDir: path.join(PROJECT_ROOT, 'data'),
  uploadDir: path.join(PROJECT_ROOT, 'data', 'uploads'),
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'Pcw@2026',
  jwtSecretEnv: process.env.JWT_SECRET || '',
  seedSamples: process.env.SEED_SAMPLES !== 'false',
  // Images in S3 (leave S3_BUCKET empty to keep images in data/uploads)
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || process.env.AWS_REGION || 'ap-south-1',
    prefix: process.env.S3_PREFIX ?? 'project/images/pcw',
    publicUrl: process.env.S3_PUBLIC_URL || '',
    endpoint: process.env.S3_ENDPOINT || '',
  },
};
