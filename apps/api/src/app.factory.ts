import { mkdirSync } from 'node:fs';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/config';
import { LocalStorageDriver } from './media/storage';

export const API_PREFIX = 'v1';

/** Builds the configured Nest application (used by main.ts and integration tests). */
export async function createApp(config: AppConfig, opts: { logger?: boolean } = {}): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(config), {
    logger: opts.logger === false ? false : ['error', 'warn', 'log'],
    bodyParser: false,
  });

  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      // Media and API responses are consumed cross-origin by web/admin/mobile clients.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
    credentials: false,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    maxAge: 600,
  });

  if (config.STORAGE_DRIVER === 'local') {
    // Development substitute for object storage (blocked in production by config validation).
    const driver = new LocalStorageDriver(config.LOCAL_STORAGE_DIR, config.API_PUBLIC_URL);
    mkdirSync(driver.root, { recursive: true });
    app.use(
      '/media',
      express.static(driver.root, {
        immutable: true,
        maxAge: '365d',
        index: false,
        dotfiles: 'deny',
        setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
      }),
    );
  }

  app.setGlobalPrefix(API_PREFIX, { exclude: ['health'] });
  app.enableShutdownHooks();
  return app;
}
