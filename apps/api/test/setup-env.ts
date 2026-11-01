import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '../../../.env'), quiet: true });

const testUrl = process.env.DATABASE_URL_TEST;
if (!testUrl) throw new Error('DATABASE_URL_TEST must be set for integration tests');
if (testUrl === process.env.DATABASE_URL) throw new Error('DATABASE_URL_TEST must differ from DATABASE_URL');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DATABASE_URL: testUrl,
  RATE_LIMIT_ENABLED: 'false',
  MODERATION_MODE: 'risk',
  STORAGE_DRIVER: 'local',
  LOCAL_STORAGE_DIR: mkdtempSync(join(tmpdir(), 'kleps-media-')),
  API_PUBLIC_URL: 'http://localhost:4000',
  LISTING_MAX_PHOTOS: '3',
  LISTING_ACTIVE_LIMIT_INDIVIDUAL: '10',
});
