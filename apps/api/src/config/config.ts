import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

export const PHOTO_MAX_BYTES_CEILING = 25 * 1024 * 1024;

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().default(4000),
    API_PUBLIC_URL: z.url().default('http://localhost:4000'),
    DATABASE_URL: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    /** A just-rotated refresh token re-presented within this window receives the same successor (bounded, ADR-014); later reuse revokes the family. */
    REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(60).default(10),
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: bool.default(false),
    RATE_LIMIT_ENABLED: bool.default(true),
    LISTING_ACTIVE_LIMIT_INDIVIDUAL: z.coerce.number().int().min(1).default(10),
    LISTING_ACTIVE_LIMIT_BUSINESS: z.coerce.number().int().min(1).default(50),
    LISTING_EXPIRY_DAYS: z.coerce.number().int().min(1).default(60),
    LISTING_MAX_PHOTOS: z.coerce.number().int().min(1).max(15).default(15),
    PHOTO_MAX_BYTES: z.coerce.number().int().min(100_000).max(PHOTO_MAX_BYTES_CEILING).default(15 * 1024 * 1024),
    VIDEO_MAX_BYTES: z.coerce.number().int().min(1_000_000).default(100 * 1024 * 1024),
    MODERATION_MODE: z.enum(['risk', 'all', 'none']).default('risk'),
    EXPIRY_SWEEP_ENABLED: bool.default(true),
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    LOCAL_STORAGE_DIR: z.string().default('./.data/uploads'),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('auto'),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
    S3_PUBLIC_BASE_URL: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      if (env.JWT_ACCESS_SECRET.startsWith('change-me')) {
        ctx.addIssue({ code: 'custom', path: ['JWT_ACCESS_SECRET'], message: 'default secret not allowed in production' });
      }
      if (env.STORAGE_DRIVER === 'local') {
        ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'local storage is a dev-only substitute' });
      }
      if (env.MODERATION_MODE === 'none') {
        ctx.addIssue({ code: 'custom', path: ['MODERATION_MODE'], message: 'moderation cannot be disabled in production' });
      }
    }
    if (env.STORAGE_DRIVER === 's3') {
      for (const key of ['S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY', 'S3_PUBLIC_BASE_URL'] as const) {
        if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: 'required when STORAGE_DRIVER=s3' });
      }
    }
  });

export type AppConfig = z.infer<typeof envSchema> & { corsOrigins: string[] };

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Parses and validates environment variables. Throws (fail fast) with a readable message. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return {
    ...parsed.data,
    corsOrigins: parsed.data.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
