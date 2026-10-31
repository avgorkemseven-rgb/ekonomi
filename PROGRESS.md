# PROGRESS — source of truth

Last updated: 2026-10-31

## Current task
T11 — API client package, then T12 web app

## Completed tasks
- T0 — Planning documents
- T1 — Monorepo foundation (pnpm + Turborepo, strict TS base config, ESLint flat config, .env.example, docker-compose)
- T2 — Shared packages: `@kleps/shared` (zod contracts, enums, Turkish normalization, money, provinces, attribute validation),
  `@kleps/tokens` (design tokens + generated CSS vars), `@kleps/i18n` (tr primary, en partial, typed `createT`)
- T3 — Database: Prisma schema, 2 migrations (init incl. `pg_trgm` + GIN trigram index; image thumbnails), idempotent seed
  (Bilardo/Dart trees: 9 categories, 23 attributes, 29 brands, models, admin user, optional demo data)
- T4 — API core + auth (argon2id, JWT access, rotating hashed refresh tokens with reuse detection, guards, throttling, helmet, zod env)
- T5 — Categories & catalog API (cached tree, inherited attributes, brands/models)
- T6 — Listings API (drafts, owner-only edits, publish with completeness checks, per-seller advisory-locked active limit,
  risk moderation, renew, close, delete drafts, expiry sweep)
- T7 — Media upload (magic-byte sniffing, sharp decode/rotate/strip/resize → WebP full + thumb, storage driver interface:
  S3/R2 + local dev substitute)
- T8 — Search API (normalized tokens + trigram index, category incl. descendants, brand, model, price, city, condition,
  seller, dynamic attribute filters incl. numeric ranges, sorting, pagination)
- T9 — Users / seller profile API
- T10 — Admin API (stats, moderation queue approve/reject/remove, category + attribute CRUD with cycle prevention,
  user suspension with session revocation, audit log)

## Pending tasks
T11 api-client · T12 web · T13 admin · T14 mobile · T15 e2e · T16 hardening/docs (see ROADMAP.md)

## Test results (2026-10-31)
| Suite | Command | Result |
|---|---|---|
| shared unit | `pnpm --filter @kleps/shared test` | 14/14 pass |
| i18n unit | `pnpm --filter @kleps/i18n test` | 3/3 pass |
| API unit | `pnpm --filter @kleps/api test` | 8/8 pass |
| API integration (real PostgreSQL) | `pnpm test:integration` | 39/39 pass (auth 8, catalog 4, listings 19, admin 8) |
| Mutation sanity check | broke limit + visibility checks | 4 tests failed as expected, code restored |
| Migration drift | `pnpm --filter @kleps/db migrate:create check` | "No schema changes" |

## Known defects
- None open. Notes: ts-jest prints a deprecation warning for `isolatedModules` (harmless).

## Blockers
None. Docker daemon unavailable in sandbox → local PostgreSQL (ADR-009). `prisma migrate dev` refuses non-interactive
shells → `migrate:create` script uses `prisma migrate diff` + shadow DB.

## Important decisions
See DECISIONS.md (ADR-001 … ADR-010).

## Next recommended action
Build `@kleps/api-client`, then the web app vertical slice.
