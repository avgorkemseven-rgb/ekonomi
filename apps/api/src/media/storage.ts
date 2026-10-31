import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { AppConfig } from '../config/config';

/** Replaceable object storage abstraction (Cloudflare R2 / any S3-compatible / local dev disk). */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');

function assertSafeKey(key: string): void {
  if (!/^[a-z0-9][a-z0-9/_.-]*$/i.test(key) || key.includes('..')) throw new Error(`Unsafe storage key: ${key}`);
}

/**
 * DEVELOPMENT SUBSTITUTE ONLY. Stores files on local disk and serves them from the API under /media.
 * Config validation forbids this driver when NODE_ENV=production.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly root: string;

  constructor(
    rootDir: string,
    private readonly publicBase: string,
  ) {
    this.root = resolve(rootDir);
  }

  private path(key: string): string {
    assertSafeKey(key);
    const full = resolve(join(this.root, key));
    if (!full.startsWith(this.root + sep)) throw new Error('Path traversal blocked');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const file = this.path(key);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  publicUrl(key: string): string {
    return `${this.publicBase.replace(/\/$/, '')}/media/${key}`;
  }
}

export class S3StorageDriver implements StorageDriver {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT || undefined,
      forcePathStyle: Boolean(config.S3_ENDPOINT),
      credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! },
    });
  }

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
  }

  async delete(key: string): Promise<void> {
    assertSafeKey(key);
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.S3_BUCKET, Key: key }));
  }

  publicUrl(key: string): string {
    return `${this.config.S3_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key}`;
  }
}

export function createStorageDriver(config: AppConfig): StorageDriver {
  return config.STORAGE_DRIVER === 's3'
    ? new S3StorageDriver(config)
    : new LocalStorageDriver(config.LOCAL_STORAGE_DIR, config.API_PUBLIC_URL);
}
