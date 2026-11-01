import { sniffImageType } from './sniff';

const pad = (b: number[]) => Buffer.concat([Buffer.from(b), Buffer.alloc(16)]);

describe('sniffImageType', () => {
  it('detects formats by magic bytes', () => {
    expect(sniffImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(sniffImageType(Buffer.concat([Buffer.from('RIFF\0\0\0\0WEBPVP8 '), Buffer.alloc(8)]))).toBe('image/webp');
    expect(sniffImageType(Buffer.concat([Buffer.from('\0\0\0\x1cftypheic'), Buffer.alloc(8)]))).toBe('image/heic');
    expect(sniffImageType(Buffer.concat([Buffer.from('\0\0\0\x1cftypavif'), Buffer.alloc(8)]))).toBe('image/avif');
  });
  it('rejects spoofed or unknown content', () => {
    expect(sniffImageType(Buffer.from('<?php echo "hi"; ?> padding padding'))).toBeNull();
    expect(sniffImageType(Buffer.from('%PDF-1.7 aaaaaaaaaaaaaaaa'))).toBeNull();
    expect(sniffImageType(Buffer.alloc(4))).toBeNull();
  });
});
