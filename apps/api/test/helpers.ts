import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import sharp from 'sharp';
import request from 'supertest';
import type { App } from 'supertest/types';
import type { AuthResponse } from '@kleps/shared';
import { createApp } from '../src/app.factory';
import { loadConfig } from '../src/config/config';
import { PrismaService } from '../src/prisma/prisma.service';

export interface TestContext {
  app: INestApplication;
  http: () => ReturnType<typeof request>;
  prisma: PrismaService;
}

export async function createTestApp(): Promise<TestContext> {
  const app = await createApp(loadConfig(), { logger: false });
  await app.init();
  const server = app.getHttpServer() as App;
  return { app, http: () => request(server), prisma: app.get(PrismaService) };
}

export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "AuditLog", "ListingImage", "Listing", "ProductModel", "_BrandCategories", "Brand", "CategoryAttribute", "Category", "Session", "User" RESTART IDENTITY CASCADE',
  );
}

export interface Catalog {
  bilardoId: string;
  cuesId: string;
  dartsId: string;
  predatorId: string;
  revoId: string;
  targetId: string;
}

/** Minimal catalog mirroring the production seed structure. */
export async function seedCatalog(prisma: PrismaService): Promise<Catalog> {
  const bilardo = await prisma.category.create({
    data: {
      slug: 'bilardo',
      name: 'Bilardo',
      attributes: { create: [{ key: 'gameType', label: 'Oyun türü', type: 'SELECT', options: ['Amerikan (Pool)', 'Snooker'], filterable: true }] },
    },
  });
  const cues = await prisma.category.create({
    data: {
      slug: 'bilardo-istakalari',
      name: 'Istakalar',
      parentId: bilardo.id,
      attributes: {
        create: [
          { key: 'cueType', label: 'Istaka tipi', type: 'SELECT', options: ['Oyun istakası', 'Kırma istakası'], required: true, filterable: true },
          { key: 'tipSize', label: 'Uç çapı', type: 'NUMBER', unit: 'mm', filterable: true, sortOrder: 1 },
        ],
      },
    },
  });
  const dart = await prisma.category.create({ data: { slug: 'dart', name: 'Dart', sortOrder: 1 } });
  const darts = await prisma.category.create({
    data: {
      slug: 'dart-oklari',
      name: 'Dart Okları',
      parentId: dart.id,
      attributes: { create: [{ key: 'barrelModel', label: 'Gövde modeli', type: 'TEXT' }] },
    },
  });
  const predator = await prisma.brand.create({ data: { slug: 'predator', name: 'Predator', categories: { connect: [{ id: cues.id }] } } });
  const revo = await prisma.productModel.create({ data: { slug: 'revo-12-4', name: 'REVO 12.4', brandId: predator.id, categoryId: cues.id } });
  const target = await prisma.brand.create({ data: { slug: 'target', name: 'Target', categories: { connect: [{ id: darts.id }] } } });
  return { bilardoId: bilardo.id, cuesId: cues.id, dartsId: darts.id, predatorId: predator.id, revoId: revo.id, targetId: target.id };
}

let counter = 0;
export async function registerUser(
  ctx: TestContext,
  overrides: Partial<{ email: string; username: string; password: string; displayName: string }> = {},
): Promise<AuthResponse & { password: string }> {
  counter += 1;
  const body = {
    email: overrides.email ?? `user${counter}-${Date.now()}@test.kleps.local`,
    username: overrides.username ?? `user${counter}${Date.now() % 100000}`,
    password: overrides.password ?? 'Sifre12345',
    displayName: overrides.displayName ?? `Test Kullanıcı ${counter}`,
  };
  const res = await ctx.http().post('/v1/auth/register').send(body).expect(201);
  return { ...(res.body as AuthResponse), password: body.password };
}

export async function makeRole(ctx: TestContext, userId: string, role: 'MODERATOR' | 'ADMIN'): Promise<void> {
  await ctx.prisma.user.update({ where: { id: userId }, data: { role } });
}

/** A real JPEG with EXIF metadata (to verify stripping). */
export async function makeJpeg(width = 800, height = 600): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: { r: 37, g: 99, b: 235 } } })
    .withExif({ IFD0: { Copyright: 'secret-owner', Artist: 'gps-test' } })
    .jpeg({ quality: 80 })
    .toBuffer();
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
