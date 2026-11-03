import { createHash, createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { APP_CONFIG, type AppConfig } from '../config/config';
import type { AccessTokenPayload } from './auth.types';

const ISSUER = 'kleps-api';
const AUDIENCE = 'kleps';

@Injectable()
export class TokenService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  signAccessToken(payload: AccessTokenPayload): { token: string; expiresAt: Date } {
    const ttl = this.config.ACCESS_TOKEN_TTL_SECONDS;
    const token = jwt.sign({ role: payload.role }, this.config.JWT_ACCESS_SECRET, {
      algorithm: 'HS256',
      subject: payload.sub,
      expiresIn: ttl,
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return { token, expiresAt: new Date(Date.now() + ttl * 1000) };
  }

  /** Returns the payload or null if the token is invalid/expired. */
  verifyAccessToken(token: string): AccessTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.config.JWT_ACCESS_SECRET, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
      });
      if (typeof decoded === 'string' || typeof decoded.sub !== 'string') return null;
      return { sub: decoded.sub, role: decoded.role as AccessTokenPayload['role'] };
    } catch {
      return null;
    }
  }

  /** 256-bit opaque refresh token. */
  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  /**
   * Deterministic successor of a refresh token: HMAC(K, predecessor) with K derived from the server secret under a
   * dedicated label (domain separation from JWT signing). Only someone holding the raw predecessor *and* the server
   * secret can compute it, which lets concurrent refreshes of the same token converge on one successor without
   * storing raw tokens (ADR-014).
   */
  deriveSuccessorToken(predecessor: string): string {
    const key = createHmac('sha256', this.config.JWT_ACCESS_SECRET).update('kleps/refresh-successor/v1').digest();
    return createHmac('sha256', key).update(predecessor).digest('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  refreshExpiry(): Date {
    return new Date(Date.now() + this.config.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  }
}
