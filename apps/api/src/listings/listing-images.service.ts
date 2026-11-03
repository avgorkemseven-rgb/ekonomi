import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ERROR_CODES, type ImageOrderInput, type ListingImageDto } from '@kleps/shared';
import type { AuthUser } from '../auth/auth.types';
import { AppError, Errors } from '../common/errors';
import { APP_CONFIG, type AppConfig } from '../config/config';
import { ImageProcessor } from '../media/image-processor';
import { STORAGE_DRIVER, type StorageDriver } from '../media/storage';
import { PrismaService } from '../prisma/prisma.service';
import { toImageDto } from './listing.mapper';
import { ListingsService } from './listings.service';

const MUTABLE_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'EXPIRED'];

@Injectable()
export class ListingImagesService {
  private readonly logger = new Logger(ListingImagesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly listings: ListingsService,
    private readonly processor: ImageProcessor,
    @Inject(STORAGE_DRIVER) private readonly storage: StorageDriver,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async upload(user: AuthUser, listingId: string, file: Express.Multer.File | undefined): Promise<ListingImageDto> {
    if (!file?.buffer?.length) throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'Missing file field "file"');
    if (file.size > this.config.PHOTO_MAX_BYTES) {
      throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, ERROR_CODES.FILE_TOO_LARGE, 'File too large');
    }
    const listing = await this.listings.getOwned(listingId, user);
    if (!MUTABLE_STATUSES.includes(listing.status)) throw Errors.invalidState('Listing photos can no longer be changed');
    const existing = await this.prisma.listingImage.count({ where: { listingId } });
    if (existing >= this.config.LISTING_MAX_PHOTOS) {
      throw new AppError(HttpStatus.CONFLICT, ERROR_CODES.PHOTO_LIMIT_REACHED, `Maximum ${this.config.LISTING_MAX_PHOTOS} photos`);
    }

    const processed = await this.processor.process(file.buffer);
    const base = `listings/${listingId}/${randomBytes(12).toString('hex')}`;
    const key = `${base}.webp`;
    const thumbKey = `${base}_thumb.webp`;
    await Promise.all([
      this.storage.put(key, processed.full.buffer, 'image/webp'),
      this.storage.put(thumbKey, processed.thumb.buffer, 'image/webp'),
    ]);

    try {
      const image = await this.prisma.$transaction(async (tx) => {
        // Re-check under lock to avoid exceeding the photo limit with parallel uploads.
        await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(hashtext(${listingId}))) AS l`;
        const count = await tx.listingImage.count({ where: { listingId } });
        if (count >= this.config.LISTING_MAX_PHOTOS) {
          throw new AppError(HttpStatus.CONFLICT, ERROR_CODES.PHOTO_LIMIT_REACHED, `Maximum ${this.config.LISTING_MAX_PHOTOS} photos`);
        }
        const last = await tx.listingImage.findFirst({ where: { listingId }, orderBy: { position: 'desc' } });
        return tx.listingImage.create({
          data: {
            listingId,
            ownerId: user.id,
            storageKey: key,
            url: this.storage.publicUrl(key),
            thumbStorageKey: thumbKey,
            thumbUrl: this.storage.publicUrl(thumbKey),
            width: processed.full.width,
            height: processed.full.height,
            sizeBytes: processed.full.buffer.length,
            mimeType: 'image/webp',
            position: last ? last.position + 1 : 0,
          },
        });
      });
      await this.listings.enforceMediaReview(listingId);
      return toImageDto(image);
    } catch (err) {
      await this.deleteObjects([key, thumbKey]);
      throw err;
    }
  }

  async remove(user: AuthUser, listingId: string, imageId: string): Promise<void> {
    const listing = await this.listings.getOwned(listingId, user);
    if (!MUTABLE_STATUSES.includes(listing.status)) throw Errors.invalidState('Listing photos can no longer be changed');
    const image = await this.prisma.listingImage.findFirst({ where: { id: imageId, listingId } });
    if (!image) throw Errors.notFound('Image');
    const count = await this.prisma.listingImage.count({ where: { listingId } });
    if (count === 1 && (listing.status === 'ACTIVE' || listing.status === 'PENDING_REVIEW')) {
      throw Errors.invalidState('A live listing must keep at least one photo');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.listingImage.delete({ where: { id: imageId } });
      const rest = await tx.listingImage.findMany({ where: { listingId }, orderBy: { position: 'asc' } });
      await Promise.all(rest.map((img, i) => tx.listingImage.update({ where: { id: img.id }, data: { position: i } })));
    });
    await this.listings.enforceMediaReview(listingId);
    await this.deleteObjects([image.storageKey, image.thumbStorageKey]);
  }

  async reorder(user: AuthUser, listingId: string, input: ImageOrderInput): Promise<ListingImageDto[]> {
    await this.listings.getOwned(listingId, user);
    const images = await this.prisma.listingImage.findMany({ where: { listingId } });
    const ids = new Set(images.map((i) => i.id));
    if (input.imageIds.length !== images.length || new Set(input.imageIds).size !== images.length || !input.imageIds.every((id) => ids.has(id))) {
      throw Errors.badRequest(ERROR_CODES.VALIDATION_ERROR, 'imageIds must list every image of the listing exactly once');
    }
    await this.prisma.$transaction(
      input.imageIds.map((id, position) => this.prisma.listingImage.update({ where: { id }, data: { position } })),
    );
    await this.listings.enforceMediaReview(listingId);
    const updated = await this.prisma.listingImage.findMany({ where: { listingId }, orderBy: { position: 'asc' } });
    return updated.map(toImageDto);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(
      keys.map((k) => this.storage.delete(k).catch((e) => this.logger.warn(`Failed to delete ${k}: ${String(e)}`))),
    );
  }
}
