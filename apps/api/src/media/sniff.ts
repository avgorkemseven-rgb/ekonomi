export type SniffedImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/avif' | 'image/heic' | 'image/gif';

const ascii = (buf: Buffer, start: number, end: number) => buf.subarray(start, end).toString('latin1');

/** Detects the real image type from magic bytes; the client-declared MIME type is ignored. */
export function sniffImageType(buf: Buffer): SniffedImageType | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return 'image/gif';
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

/** Types we accept and can decode server-side. HEIC is detected but rejected (clients convert to JPEG). */
export const ACCEPTED_IMAGE_TYPES: ReadonlySet<SniffedImageType> = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
