# KLEPS

Mobile-first sports equipment marketplace for Türkiye (Turkish-first; billiards and darts first).
Monorepo: NestJS API · Next.js web · Next.js admin · Expo mobile · PostgreSQL/Prisma.

Planning docs: [PRD](PRD.md) · [Architecture](ARCHITECTURE.md) · [Roadmap & backlog](ROADMAP.md) ·
[Decisions](DECISIONS.md) · [Progress (source of truth)](PROGRESS.md) · [Agent guide](CLAUDE.md)

## 1. Prerequisites

- Node.js ≥ 22, pnpm 10 (`corepack enable`)
- PostgreSQL 16 with the `pg_trgm` extension available (bundled with standard PostgreSQL), **or** Docker for `docker-compose.yml`
- For mobile: Expo Go / Android Studio / Xcode on your machine (not required to run the web stack)

## 2. Local setup

```bash
pnpm install
cp .env.example .env            # then edit secrets (see §3)

# Option A — Docker
docker compose up -d postgres   # creates kleps + kleps_test databases

# Option B — local PostgreSQL
psql -U postgres -c "CREATE ROLE kleps LOGIN PASSWORD 'kleps' CREATEDB;"
createdb -U postgres -O kleps kleps
createdb -U postgres -O kleps kleps_test
createdb -U postgres -O kleps kleps_shadow   # only needed to author new migrations

pnpm db:deploy                  # apply migrations
pnpm db:seed                    # categories, attributes, brands/models, admin (+ demo data if SEED_DEMO=true)
pnpm build                      # builds shared packages and apps
pnpm dev                        # api :4000, web :3000, admin :3001, expo dev server
```

Production-like local run: `pnpm --filter @kleps/api start`, `pnpm --filter @kleps/web start`, `pnpm --filter @kleps/admin start`.

Seeded accounts (development only):
- Admin: `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` from `.env` → admin panel at http://localhost:3001
- Demo sellers (when `SEED_DEMO=true`): `kaan@demo.kleps.local`, `ece@demo.kleps.local`, password `DemoKleps123`

## 3. Environment variables

All variables are documented in [`.env.example`](.env.example). Key ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DATABASE_URL_TEST`, `SHADOW_DATABASE_URL` | Main DB, integration-test DB (truncated by tests!), scratch DB for authoring migrations |
| `JWT_ACCESS_SECRET` | ≥ 32 chars; generate with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`. Default value is rejected in production |
| `ACCESS_TOKEN_TTL_SECONDS`, `REFRESH_TOKEN_TTL_DAYS`, `REFRESH_REUSE_GRACE_SECONDS` | Session lifetimes; bounded refresh-replay window for parallel requests (ADR-014) |
| `CORS_ORIGINS` | Browser origins allowed to call the API directly (web/admin use the server-side proxy) |
| `TRUST_PROXY` | `true` behind a reverse proxy (Railway) so client IPs/rate limits are correct |
| `LISTING_ACTIVE_LIMIT_INDIVIDUAL` (10), `LISTING_ACTIVE_LIMIT_BUSINESS` (50), `LISTING_EXPIRY_DAYS` (60), `LISTING_MAX_PHOTOS` (15), `PHOTO_MAX_BYTES`, `VIDEO_MAX_BYTES` | Marketplace rules |
| `MODERATION_MODE` | `risk` (default), `all`, `none` (refused in production) |
| `STORAGE_DRIVER` | `local` (dev only, refused in production) or `s3` with `S3_*` variables (Cloudflare R2) |
| `API_INTERNAL_URL` | Server-side API URL for web/admin |
| `NEXT_PUBLIC_SITE_URL` | Public web URL (metadata, admin links) |
| `EXPO_PUBLIC_API_URL` | API URL reachable from the device (`http://10.0.2.2:4000` on the Android emulator, LAN IP on a phone) |

Never commit `.env`. The API validates its environment at boot and refuses to start on invalid/insecure production config.

## 4. Database migrations

```bash
pnpm db:deploy                                        # apply pending migrations (CI / production)
pnpm db:status                                        # show migration status
pnpm --filter @kleps/db migrate:create <name>         # create a migration from schema.prisma changes (non-interactive)
pnpm db:migrate                                       # interactive `prisma migrate dev` (local TTY only)
```

The initial migration enables `pg_trgm` and creates a GIN trigram index for search (`CREATE EXTENSION` requires a role
allowed to create trusted extensions — the database owner on PostgreSQL ≥ 13). Review generated SQL before deploying.

## 5. Seed data

`pnpm db:seed` is idempotent (upserts). It creates the Bilardo and Dart category trees with category-specific attributes,
29 brands with models, and the admin user. `SEED_DEMO=true` adds two demo sellers and six listings (never in production).

## 6. Tests

```bash
pnpm typecheck          # all packages and apps (strict TS)
pnpm lint               # ESLint flat config
pnpm test               # unit tests (shared, i18n, api-client, api)
pnpm test:integration   # API against real PostgreSQL (DATABASE_URL_TEST — it is TRUNCATED)
pnpm build              # includes Next.js production builds

# End-to-end (Playwright, Chromium desktop + mobile viewport). Requires api :4000, web :3000, admin :3001 running.
pnpm test:e2e
# Optional: also check the Expo app's screens via react-native-web
pnpm --filter @kleps/mobile export:web   # then serve apps/mobile/dist-export/web with SPA fallback on :8081
E2E_MOBILE_WEB_URL=http://localhost:8081 pnpm test:e2e

# Mobile checks (no native build)
pnpm --filter @kleps/mobile typecheck
pnpm --filter @kleps/mobile config:check
pnpm --filter @kleps/mobile export:android   # Metro bundle → Hermes bytecode
pnpm --filter @kleps/mobile export:ios
```

## 7. Functionality inventory (phase 1)

- **Auth:** email/password registration & login, argon2id, short-lived JWT + rotating hashed refresh tokens with reuse
  detection, logout, immediate effect of suspension/role changes. Web/admin keep tokens in httpOnly cookies (BFF proxy, CSRF
  origin check); mobile uses SecureStore.
- **Catalog:** dynamic category tree, inherited category attributes (text/number/select/boolean), brands per category, models per brand.
- **Listings:** drafts, edit, delete drafts, publish with completeness checks, 10 active listing limit (per-user override),
  risk-based moderation (contact info, links, IBAN, off-platform payment, counterfeit terms, velocity, suspicious price),
  60-day expiry with free renewal, close as sold/archived, view counter.
- **Photos:** up to 15, magic-byte validation, full decode, EXIF/GPS stripped, WebP full (≤1600 px) + thumbnail, reorder, delete.
- **Search:** Turkish-normalized keyword search (ı/i, ş/s …), category incl. sub-categories, brand, model, price, city,
  condition, seller, dynamic attribute filters (select/boolean/numeric ranges), sorting, pagination.
- **Profiles:** public seller profile and listings (no email/phone exposure), profile editing.
- **Web:** home, categories, search with filters (works without JS), listing detail with gallery, seller page, auth,
  multi-step listing creation, photo manager, my listings (publish/renew/close/delete), account; responsive, dark mode,
  keyboard accessible, Turkish copy from `@kleps/i18n`.
- **Admin:** moderator/admin login, dashboard stats, moderation queue (approve/reject with reason/remove), category and
  attribute management (ADMIN), user suspension (ADMIN), audit log.
- **Mobile:** discover, search with filters, category, listing detail with swipe gallery, seller profile, login/register,
  sell flow (category → details → photo picker upload → publish), my listings, account.

## 8. Known limitations

See PROGRESS.md → "Known defects / limitations". Highlights: no payments, messaging, favorites, reports, saved searches,
Google/Apple sign-in, phone/email verification or video upload yet; native iOS/Android builds not executed here; HEIC
uploads are rejected server-side (the mobile picker converts to JPEG); search is PostgreSQL-based; expiry sweep runs
in-process (one instance should run it; move to a job queue when scaling out); legal texts are placeholders and need counsel.

## 9. Deployment prerequisites

- **Database:** managed PostgreSQL 16 (+ `pg_trgm`), backups, `pnpm db:deploy` in the release step. Consider hosting region
  under KVKK cross-border transfer rules.
- **API (Railway or any container host):** `pnpm --filter @kleps/api build && node apps/api/dist/main.js`; set
  `NODE_ENV=production`, strong `JWT_ACCESS_SECRET`, `TRUST_PROXY=true`, `STORAGE_DRIVER=s3` + R2 credentials,
  `CORS_ORIGINS`, health check at `GET /health`.
- **Media:** Cloudflare R2 bucket with a public custom domain (`S3_PUBLIC_BASE_URL`); credentials server-side only.
- **Web/admin (Vercel):** set `API_INTERNAL_URL` and `NEXT_PUBLIC_SITE_URL`; restrict the admin deployment (separate domain,
  optional IP allow-list / SSO).
- **Mobile (EAS):** Expo account, `eas.json` profiles, Apple Developer and Google Play accounts, bundle IDs
  `app.kleps.mobile`, `EXPO_PUBLIC_API_URL` per profile.
- **Legal/compliance:** KVKK privacy notice & VERBİS assessment, terms of use, e-commerce law (6563) obligations, consumer
  law (6502) for business sellers, licensed PSP contract before any checkout work. Nothing here constitutes legal advice.

## 10. Next development tasks

See ROADMAP.md (phase 2 head of queue): favorites → listing reports & admin report queue → saved searches → BullMQ jobs
(expiry, notifications) → SMS phone-verification adapter → Google/Apple sign-in → messaging → EAS builds & store setup.
