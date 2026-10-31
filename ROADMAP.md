# KLEPS — Roadmap & Ordered Backlog

## Phases

| Phase | Theme | Contents |
|---|---|---|
| **1** | Marketplace MVP (current) | Monorepo, auth, categories/attributes, brand/model catalog, listings (draft→publish), photos, search, web, mobile, admin basics |
| 2 | Engagement & trust | Favorites, saved searches, following, reports, messaging, phone verification, Google/Apple sign-in, push notifications, price-drop alerts, background jobs (Redis/BullMQ) |
| 3 | Commerce | Licensed PSP integration (sub-merchant), platform checkout, orders, commission, disputes, refunds, verified reviews, transaction counts |
| 4 | Professional & monetization | Business verification workflow, storefronts, subscriptions (tiers), extra capacity, featured/sponsored listings, category showcases, ad packages (3/7/15 days) |
| 5 | Compliance & ops hardening | Contract versioning + consent records, data-subject requests, retention, admin RBAC granularity, observability |
| 6 | Advanced discovery | Personalized feed, dedicated search engine, natural-language search, image search, video upload & transcoding |

## Phase 1 ordered backlog

Each task has acceptance criteria (AC). Status is tracked in `PROGRESS.md`.

### T1 — Monorepo foundation
AC: pnpm workspace + Turborepo; strict `tsconfig.base.json`; ESLint flat config; `.env.example`; `.gitignore` excludes secrets;
`docker-compose.yml` for Postgres/Redis/MinIO; `pnpm typecheck` and `pnpm lint` run across packages.

### T2 — Shared packages
AC: `@kleps/shared` exports zod schemas for auth, listings, categories, search query, pagination; `normalizeTurkish`, `slugify`,
`formatPrice`, provinces list; unit tests pass. `@kleps/tokens` exports tokens + CSS. `@kleps/i18n` exports `tr` messages and `createT`.

### T3 — Database
AC: Prisma schema per ARCHITECTURE §4; initial migration incl. `pg_trgm` + GIN index; seed creates Bilardo & Dart category trees with
attributes, brands and models (idempotent upsert); optional demo users/listings with `SEED_DEMO=true`; `prisma migrate status` clean.

### T4 — API core + auth
AC: register/login/refresh/logout/me; argon2id; refresh rotation + reuse detection; guards; rate limiting; helmet; zod env config;
consistent error format; integration tests for auth happy + failure paths.

### T5 — Categories & catalog API
AC: tree endpoint; category detail with inherited attributes and brands; brand/model endpoints; inactive categories hidden; tests.

### T6 — Listings API
AC: create draft (validated against category attributes), update (owner only), delete draft, publish (limit of 10 active for individuals,
risk moderation → ACTIVE or PENDING_REVIEW, sets `expiresAt = now + 60d`), renew (expired or near expiry, free), close (SOLD/ARCHIVED),
my listings; public detail hides non-active from non-owners; tests incl. authorization (other user cannot edit) and limit enforcement.

### T7 — Media upload
AC: multipart upload to own draft/active listing; magic-byte + size validation; sharp re-encode to WebP, EXIF stripped; max 15 photos;
delete + reorder; storage driver interface with local dev substitute + S3 driver; tests with real image bytes and a spoofed file.

### T8 — Search API
AC: paginated `GET /listings` with q (Turkish-normalized), category incl. descendants, brand, model, price range, city, condition, sort
(newest, price asc/desc); only ACTIVE & non-expired; tests incl. “ıstaka” matching “ISTAKA”.

### T9 — Users / seller profile API
AC: public profile (no email/phone exposure), seller's active listings, member since, active listing count; update own profile.

### T10 — Admin API
AC: role-guarded (MODERATOR+); stats; moderation queue; approve/reject (reason)/remove; category CRUD + attributes (ADMIN); audit log
entries for every admin action; tests that USER gets 403.

### T11 — API client package
AC: typed functions for all endpoints used by clients; error type with `code`; refresh-on-401 helper.

### T12 — Web app
AC: KLEPS wordmark & design tokens; home (categories + latest), category page with dynamic filters, search page, listing detail with
gallery + seller card, seller profile, login/register, create listing flow (category → details/attributes → photos → publish), my
listings (publish/renew/close/edit), loading/empty/error states, responsive, keyboard accessible; `next build` passes.

### T13 — Admin app
AC: admin login (rejects non-moderators), dashboard stats, moderation queue with approve/reject/remove, categories + attributes
management, audit log; `next build` passes.

### T14 — Mobile app
AC: Expo Router tabs (Keşfet, Ara, İlan Ver, Hesabım); listing detail; seller profile; login/register; create listing with photo picker
and upload; my listings; uses same API; `tsc --noEmit` passes; `expo config` valid; JS bundle exports for Android/iOS
(`expo export`) — not a native build.

### T15 — End-to-end verification
AC: Playwright test: user A registers on web, creates listing with photo, publishes; user B (fresh context) searches and views it and
the seller profile. API-level test confirms the same listing is returned to an unauthenticated client (mobile path).

### T16 — Hardening & docs
AC: README with setup/env/migrations/seed/tests/deploy prerequisites; PROGRESS final state; known limitations listed.

### Next after phase 1 (phase 2 head of queue)
Phase 1 (T1–T16) is complete — see PROGRESS.md.

T17 favorites · T18 listing reports + admin report queue · T19 saved searches · T20 expiry job via BullMQ · T21 phone verification
adapter (SMS provider interface) · T22 Google/Apple sign-in · T23 messaging · T24 EAS build profiles + native builds ·
T25 framework major upgrades (ADR-001) · T26 contract versioning + consent records.
