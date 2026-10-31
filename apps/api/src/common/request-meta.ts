import type { Request } from 'express';
import type { ClientMeta } from '../auth/auth.service';

export function clientMeta(req: Request): ClientMeta {
  const ua = req.headers['user-agent'];
  return { ip: req.ip, userAgent: typeof ua === 'string' ? ua : undefined };
}
