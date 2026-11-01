import { HttpStatus, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { ERROR_CODES } from '@kleps/shared';
import { AppError } from '../common/errors';
import { ACCEPTED_IMAGE_TYPES, sniffImageType } from './sniff';

export interface ProcessedImage {
  full: { buffer: Buffer; width: number; height: number };
  thumb: { buffer: Buffer; width: number; height: number };
  sourceType: string;
}

const MAX_INPUT_PIXELS = 60_000_000; // guards against decompression bombs
const FULL_SIZE = 1600;
const THUMB_SIZE = 480;

@Injectable()
export class ImageProcessor {
  /**
   * Validates by magic bytes, fully decodes (rejecting corrupt/malicious files), applies EXIF orientation,
   * strips all metadata (incl. GPS), resizes and re-encodes to WebP.
   */
  async process(input: Buffer): Promise<ProcessedImage> {
    const type = sniffImageType(input);
    if (!type || !ACCEPTED_IMAGE_TYPES.has(type)) {
      throw new AppError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ERROR_CODES.UNSUPPORTED_MEDIA_TYPE,
        type === 'image/heic' ? 'HEIC is not supported; please upload JPEG' : 'Unsupported image type',
      );
    }
    try {
      const base = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate();
      const meta = await base.metadata();
      if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) {
        throw new AppError(HttpStatus.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, 'Image must be at least 200x200 px');
      }
      const [full, thumb] = await Promise.all([
        base
          .clone()
          .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true }),
        base
          .clone()
          .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 75 })
          .toBuffer({ resolveWithObject: true }),
      ]);
      return {
        full: { buffer: full.data, width: full.info.width, height: full.info.height },
        thumb: { buffer: thumb.data, width: thumb.info.width, height: thumb.info.height },
        sourceType: type,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, ERROR_CODES.UNSUPPORTED_MEDIA_TYPE, 'Image could not be decoded');
    }
  }
}
