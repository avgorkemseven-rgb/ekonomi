import { loadConfig } from '../config/config';
import { TokenService } from './token.service';

const make = (secret: string) =>
  new TokenService(loadConfig({ DATABASE_URL: 'postgresql://x', JWT_ACCESS_SECRET: secret } as NodeJS.ProcessEnv));

describe('TokenService.deriveSuccessorToken', () => {
  const a = make('a'.repeat(40));
  it('is deterministic for the same predecessor', () => {
    expect(a.deriveSuccessorToken('tok-1')).toBe(a.deriveSuccessorToken('tok-1'));
  });
  it('differs per predecessor and is not the predecessor or its storage hash', () => {
    const s = a.deriveSuccessorToken('tok-1');
    expect(s).not.toBe(a.deriveSuccessorToken('tok-2'));
    expect(s).not.toBe('tok-1');
    expect(s).not.toBe(a.hashToken('tok-1'));
    expect(s).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
  it('depends on the server secret', () => {
    expect(make('b'.repeat(40)).deriveSuccessorToken('tok-1')).not.toBe(a.deriveSuccessorToken('tok-1'));
  });
});
