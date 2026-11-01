import 'server-only';

/** Server-side base URL of the KLEPS API (never exposed to the browser). */
export const API_INTERNAL_URL = (process.env.API_INTERNAL_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const IS_PRODUCTION = process.env.NODE_ENV === 'production';
