# Architecture Decision Records

Append-only. Format: ID — title · date · status · context → decision → consequences.

## ADR-001 — Pin well-established framework majors · 2026-10-31 · accepted
Context: npm `latest` tags at project start include very new majors (TypeScript 7 native, NestJS 12, Prisma 8 RC, Expo SDK 58).
Decision: Pin TypeScript 5.9, NestJS 11, Prisma 6.19, Next.js 16, Expo SDK 54 (RN 0.81), zod 4, Tailwind 4, Turborepo 2.
Consequences: Predictable tooling now; planned upgrade task once the codebase has test coverage (upgrade is mechanical, not architectural).

## ADR-002 — Shared packages compiled to CommonJS with tsc · 2026-10-31 · accepted
Context: NestJS compiles to CJS; Next.js and Metro both consume CJS without config.
Decision: `packages/*` build with `tsc` to `dist/` (CJS + d.ts). Turbo `build` depends on `^build`.
Consequences: Need to build packages before typechecking apps (handled by turbo pipeline).

## ADR-003 — Custom JWT access + opaque rotating refresh tokens · 2026-10-31 · accepted
Decision: HS256 access JWT (15 min) + 256-bit opaque refresh token stored as SHA-256 hash with family-based reuse detection.
Passwords hashed with argon2id (`@node-rs/argon2`, prebuilt binaries). No third-party auth vendor lock-in; Google/Apple will be added
as `AuthIdentity` providers later. Consequences: we own session security; covered by integration tests.

## ADR-004 — Web/admin use a BFF cookie session · 2026-10-31 · accepted
Decision: Next.js route handlers keep tokens in httpOnly cookies and proxy API calls. Browsers never handle tokens; the API needs no
browser CORS for web. Mobile uses bearer tokens with SecureStore.

## ADR-005 — Search on PostgreSQL with normalized text + pg_trgm · 2026-10-31 · accepted
Decision: store a Turkish-normalized `searchText` column and match normalized tokens with ILIKE backed by a GIN trigram index.
Consequences: no extra infrastructure in phase 1; swap to a search engine behind `ListingsSearch` when needed.

## ADR-006 — Media re-encoding with sharp, storage driver interface · 2026-10-31 · accepted
Decision: Validate magic bytes, decode with sharp, strip metadata, resize, re-encode WebP. Local disk driver is a dev-only substitute
(blocked in production); S3 driver targets Cloudflare R2. Consequences: uploads go through the API (fine for photos ≤ 15 MB);
video will use presigned direct uploads later.

## ADR-007 — Risk-based moderation as rule heuristic in phase 1 · 2026-10-31 · accepted
Decision: on publish, a rule-based scorer flags contact info / external links / IBAN / blocked terms / suspicious pricing / brand-new
accounts publishing many listings. Flagged → PENDING_REVIEW; otherwise ACTIVE. `MODERATION_MODE=risk|all|none` (none forbidden in production).
Consequences: simple, explainable; reasons stored on the listing for moderators.

## ADR-008 — Money as integer kuruş · 2026-10-31 · accepted
Decision: `priceAmount Int` in kuruş + `currency` ('TRY'). Clients send TL with up to 2 decimals converted in shared helpers.

## ADR-009 — Local PostgreSQL in this environment · 2026-10-31 · accepted
Context: Docker daemon is unavailable in the build sandbox. Decision: use locally installed PostgreSQL 16 for development/tests;
`docker-compose.yml` is still provided for contributors. Local storage driver is used instead of MinIO here.

## ADR-010 — Offset pagination in phase 1 · 2026-10-31 · accepted
Decision: `page`/`pageSize` (max 50) with total counts; fine at MVP scale and simplest for UIs. Switch heavy feeds to cursor pagination later.

## ADR-011 — Refresh-token reuse grace window · 2026-10-31 · accepted
Context: the web BFF can receive parallel requests that all try to refresh with the same (single-use) refresh token; strict
reuse detection would revoke the session family and log the user out. Decision: a rotated token presented again within
`REFRESH_REUSE_GRACE_SECONDS` (default 10 s) is rejected **without** revoking the family; after the window it is treated as
theft. The browser client retries once. Mobile deduplicates refreshes in-process.

## ADR-012 — No root `loading.tsx` in the web app · 2026-10-31 · accepted
Context: a root Suspense boundary makes Next.js stream a 200 before `notFound()` runs, so unknown listings/sellers returned
HTTP 200. Decision: no root loading boundary; client pages render their own spinners. Unknown resources now return 404.

## ADR-013 — Mobile verification without native builds · 2026-10-31 · accepted
Context: the sandbox cannot run iOS/Android simulators or EAS. Decision: verify mobile with `tsc`, `expo config`,
`expo export` for android + ios (Metro → Hermes bytecode), and a react-native-web export exercised by Playwright against the
real API. None of these prove a native build succeeds; EAS builds remain a pending step.
