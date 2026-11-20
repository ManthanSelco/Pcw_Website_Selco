import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

dotenv.config({ path: path.join(SERVER_ROOT, '.env') });

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI || '',
  jsonFile: path.join(PROJECT_ROOT, 'data', 'db.json'),
  clientDist: path.join(PROJECT_ROOT, 'client', 'dist'),
  cdnCache: path.join(PROJECT_ROOT, 'data', 'cdn-cache'),
};
