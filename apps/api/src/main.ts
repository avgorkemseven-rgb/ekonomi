import 'reflect-metadata';
import { resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { config as loadDotenv } from 'dotenv';
import { createApp } from './app.factory';
import { loadConfig } from './config/config';

// Local development convenience: load the monorepo root .env (real deployments inject env vars).
loadDotenv({ path: resolve(__dirname, '../../../.env'), quiet: true });

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await createApp(config);
  await app.listen(config.API_PORT, '0.0.0.0');
  new Logger('Bootstrap').log(`KLEPS API listening on :${config.API_PORT} (${config.NODE_ENV})`);
}

void bootstrap();
