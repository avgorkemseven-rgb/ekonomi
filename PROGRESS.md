# PROGRESS — source of truth

Last updated: 2026-11-03

## Milestone 1 status
**Met (verified in this environment).** A user registers on the web, creates a listing with a photo, publishes it; a
separate anonymous browser finds it via Turkish-insensitive search and views the detail and seller profile; the same record
is returned by the shared API to an unauthenticated client (mobile path) and rendered by the Expo app's screens via
react-native-web. Native iOS/Android binaries were **not** built (no simulators/EAS in the sandbox).

## Current task
Phase 1.1 — Security & reliability hardening (branch `fix/phase-1-security-hardening`, PR to `main`, awaiting review).

## Phase 1.1 — Security & reliability hardening (2026-11-03)
Three findings from independent code review, each reproduced with a failing test before the fix:
| # | Finding | Fix | Evidence |
|---|---|---|---|
| H1 | Concurrent refreshes with one token revoked the whole session family (5 parallel → 1×200, 4×401, family revoked) | Row lock + deterministic successor + bounded in-window replay (ADR-014) | `test/refresh-concurrency.e2e-spec.ts` 9/9; mutation (lock removed) fails the concurrency test |
| H2 | Live listings could be changed without moderation (category, brand/model, district, text attributes, photos, expired → edit → renew) | Re-assessment of content edits, review on category change, photo baseline `contentReviewedAt` with cover/majority rule, checks on renew (ADR-015) | `test/moderation-bypass.e2e-spec.ts` 14/14 (9 failed before the fix); policy unit tests; mutation (photo/renew checks disabled) fails 5 tests |
| H3 | BFF proxies buffered whole bodies before the size check; chunked bodies without Content-Length unbounded (64 MB received before 413) | Streaming reader with hard limit + Content-Length pre-check, bounded auth JSON (ADR-016) | `api-client` unit tests (endless stream terminates); `e2e/tests/bff-limits.spec.ts` 9/9 for web + admin; old code fails the chunked test (64 MB received) |

## Completed tasks
- T0 — Planning documents
- T1 — Monorepo foundation (pnpm + Turborepo, strict TS, ESLint flat config, .env.example, docker-compose)
- T2 — Shared packages: `@kleps/shared`, `@kleps/tokens`, `@kleps/i18n`
- T3 — Database: Prisma schema, 2 migrations (init with `pg_trgm` + GIN trigram index; image thumbnails), idempotent seed
- T4 — API core + auth (argon2id, JWT, rotating refresh tokens with reuse detection + grace window, guards, throttling, helmet, env validation)
- T5 — Categories & catalog API
- T6 — Listings API (drafts, publish checks, advisory-locked active limit, risk moderation, renew, close, expiry sweep)
- T7 — Media upload (magic bytes, sharp re-encode, EXIF strip, thumbnails, S3/R2 driver + local dev substitute)
- T8 — Search API (Turkish normalization, trigram index, filters incl. dynamic attributes, sort, pagination; LIKE wildcards escaped)
- T9 — Seller profile API
- T10 — Admin API (stats, moderation, categories/attributes, user suspension, audit log)
- T11 — `@kleps/api-client`
- T12 — Web app (Next.js 16, BFF cookie session + CSRF origin check, all phase-1 pages)
- T13 — Admin app (moderation, categories/attributes, users, audit)
- T14 — Mobile app (Expo SDK 54 / expo-router)
- T15 — End-to-end verification (Playwright)
- T16 — README, env template, docs

## Pending tasks (phase 2, ordered)
T17 favorites · T18 listing reports + admin report queue · T19 saved searches · T20 BullMQ jobs (expiry, notifications) ·
T21 phone verification adapter · T22 Google/Apple sign-in · T23 messaging · T24 EAS build profiles + first native builds ·
T25 framework major upgrades (ADR-001) · T26 contract versioning + consent records

## Test results (2026-11-03, Phase 1.1 final run)
| Gate | Command | Result |
|---|---|---|
| Type checking | `pnpm typecheck` | 15/15 tasks pass |
| Linting | `pnpm lint` | 15/15 tasks pass |
| Unit tests | `pnpm test` | shared 14, i18n 3, api-client 12, api 17 — all pass |
| API integration (real PostgreSQL) | `pnpm test:integration` | 62/62 pass (6 suites) |
| Migrations | `pnpm db:status`; `migrate:create drift_check` | up to date; no drift (2 new migrations) |
| Production builds | `pnpm build` | 8/8 |
| E2E (Playwright) | `pnpm test:e2e` | 19 passed, 13 skipped by design (transport/admin tests desktop-only; mobile-web needs `E2E_MOBILE_WEB_URL`, not affected by this change) |

## Test results (2026-10-31, phase 1 final run)
| Gate | Command | Result |
|---|---|---|
| Type checking | `pnpm typecheck` | 15/15 tasks pass |
| Linting | `pnpm lint` | 15/15 tasks pass |
| Unit tests | `pnpm test` | shared 14, i18n 3, api-client 6, api 8 — all pass |
| API integration (real PostgreSQL) | `pnpm test:integration` | 39/39 pass |
| Mutation sanity check | broke limit + visibility rules | 4 tests failed as expected; code restored |
| Migrations | `pnpm db:status`; `migrate:create check` | up to date; no drift |
| Production builds | `pnpm build` | 8/8 (packages, API, web, admin) |
| E2E (Playwright, desktop + Pixel 7) | `pnpm test:e2e` (+ `E2E_MOBILE_WEB_URL`) | 11 passed, 3 skipped by design (admin on mobile viewport; mobile-web on desktop) |
| Mobile | `tsc --noEmit`, `expo config`, `expo export` android + ios + web | pass; Hermes bundles produced |
| expo-doctor | `npx expo-doctor` | 16/18; 2 failed only because `exp.host` is unreachable from the sandbox |

## Failures found and fixed during this session
- Web price input rejected "42.500" (Turkish thousands separator) → `tlToKurus` now recognizes grouped thousands (E2E caught it).
- Unknown listing/seller pages returned HTTP 200 → removed root `loading.tsx` (ADR-012); now 404.
- Parallel refreshes could revoke a session family → reuse grace window (ADR-011; incomplete — fixed properly in Phase 1.1, ADR-014).
- `expo-secure-store` throws on web preview → in-memory fallback on web only.
- Search tokens containing `%` acted as LIKE wildcards → escaped.
- API build: `multer` types/import; test helper typing; db seed missing `@types/node`.

## Known defects / limitations
- Not implemented (documented for later phases): payments/PSP, messaging, favorites, saved searches, reports, reviews,
  subscriptions/ads, Google/Apple sign-in, phone/email verification, video upload, data-subject request workflow.
- No email verification yet: anyone can register with any address (rate-limited 10/min/IP on auth endpoints).
- HEIC uploads rejected server-side (prebuilt sharp lacks HEVC); mobile picker re-encodes to JPEG.
- Expiry sweep runs in-process every 10 min; reads already hide expired listings. Run on one instance or move to a queue.
- Category cache is per-process with a 60 s TTL; multi-instance admin edits propagate within a minute.
- Offset pagination (ADR-010); PostgreSQL search (ADR-005).
- Admin/web share no SSO; admin panel should be deployed on a restricted domain.
- Terms/privacy texts are placeholders; compliance requirements (KVKK, 6563, 6502, 6493) need legal review.
- ts-jest prints an `isolatedModules` deprecation warning (harmless).
- Phase 1.1 residual risks: no image-content analysis (photo content is never inspected automatically; a minority of
  added photos goes live unreviewed); contact info alone scores below the review threshold (calibration); a moderator can
  approve a version edited after they opened it (no optimistic version check); a refresh token stolen and replayed within
  ≤10 s of the legitimate rotation yields the same successor as the victim (detected on the successor's second use).

## Blockers
None for continued development. Requires the owner: EAS/Apple/Google accounts for native builds; R2 + managed Postgres +
Railway/Vercel credentials for deployment; PSP contract before commerce work; legal counsel for compliance texts.

## Important decisions
DECISIONS.md ADR-001 … ADR-016 (ADR-011 superseded by ADR-014).

## Next recommended action
Review and merge the Phase 1.1 PR. Then T17 favorites (small, unblocked), then T18 reports — both feed moderation; in parallel set up EAS build profiles once accounts exist.
