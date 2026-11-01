# KLEPS — Architecture

## 1. Overview

```
            ┌──────────────┐      ┌──────────────┐     ┌──────────────┐
            │  apps/web    │      │  apps/admin  │     │ apps/mobile  │
            │  Next.js     │      │  Next.js     │     │ Expo / RN    │
            │  (BFF proxy) │      │  (BFF proxy) │     │ SecureStore  │
            └──────┬───────┘      └──────┬───────┘     └──────┬───────┘
     httpOnly cookies│  Bearer           │ Bearer             │ Bearer
                     ▼                   ▼                    ▼
            ┌────────────────────────────────────────────────────────┐
            │                 apps/api  (NestJS, /v1)                │
            │ auth · users · categories · catalog · listings · media │
            │ search · moderation · admin · audit                    │
            └──────┬──────────────────┬───────────────────┬──────────┘
                   ▼                  ▼                   ▼
             PostgreSQL          Object storage        (Redis — later:
             (Prisma)            S3/R2 or local disk    queues, rate limits, cache)
```

TypeScript monorepo: **pnpm workspaces + Turborepo**. Shared packages are compiled with `tsc` to CommonJS + `.d.ts` so the
NestJS (CJS), Next.js and Metro bundlers all consume the same artifacts.

## 2. Packages

| Package | Responsibility |
|---|---|
| `@kleps/shared` | zod schemas = API contracts (request + response types), enums, constants (limits), utils: `normalizeTurkish`, `slugify`, money formatting, Turkish provinces list |
| `@kleps/db` | Prisma schema, migrations (incl. raw SQL for `pg_trgm`), seed scripts, `PrismaClient` re-export |
| `@kleps/api-client` | Typed `fetch` client. Takes `baseUrl` + async token getter. Used by web/admin (server side & via proxy) and mobile |
| `@kleps/tokens` | Design tokens (TS object) + generated `tokens.css` (CSS variables incl. dark mode) |
| `@kleps/i18n` | `locales/tr.json` (primary), `en.json` (partial), typed `createT(locale)` |

## 3. API (apps/api)

NestJS 11 modules: `config`, `prisma`, `auth`, `users`, `categories`, `catalog` (brands/models), `listings`, `media`, `admin`, `audit`, `health`.

- **Validation:** `ZodValidationPipe` with schemas from `@kleps/shared`. Errors → `400 { error: 'VALIDATION_ERROR', issues }`.
- **Errors:** consistent JSON `{ statusCode, error, message }`; stable machine-readable `error` codes used by clients for localization.
- **Security:** helmet, CORS allow-list, `@nestjs/throttler` (stricter on auth), argon2id password hashing, request size limits.
- **Auth:** access token = JWT HS256 (15 min, `sub`, `role`); refresh token = 256-bit random opaque token, stored **hashed**
  (SHA-256) in `Session`, rotated on every refresh; reuse of a rotated token revokes the whole session family.
  Guards: `JwtAuthGuard` (required), `OptionalAuthGuard`, `RolesGuard` with `@Roles('MODERATOR')`.
- **Authorization:** ownership checks in services (seller can only modify own listings); role checks for admin routes;
  suspended users cannot authenticate or publish.
- **Config:** env validated by zod at boot; fails fast on missing secrets in production.

### Key endpoints (`/v1`)

```
POST /auth/register | /auth/login | /auth/refresh | /auth/logout      GET /auth/me
PATCH /me
GET  /categories (tree)   GET /categories/:slug (with inherited attributes + brands)
GET  /brands?category=slug   GET /brands/:id/models
GET  /listings  (search: q, category, brand, model, minPrice, maxPrice, city, condition, sort, page, pageSize)
GET  /listings/:id
POST /listings (draft)  PATCH /listings/:id  DELETE /listings/:id (draft only)
POST /listings/:id/publish | /renew | /close
POST /listings/:id/images (multipart, field "file")  DELETE /listings/:id/images/:imageId  PUT /listings/:id/images/order
GET  /me/listings?status
GET  /users/:username   GET /users/:username/listings
GET  /admin/stats  GET /admin/listings  POST /admin/listings/:id/approve|reject|remove
GET/POST/PATCH /admin/categories ...  POST/PATCH/DELETE /admin/categories/:id/attributes ...
GET  /admin/audit-logs
GET  /health
```

## 4. Data model (Prisma, summarized)

- `User` (email unique, username unique, passwordHash, displayName, role USER|MODERATOR|ADMIN, sellerType INDIVIDUAL|BUSINESS,
  verificationStatus NONE|PENDING|VERIFIED, status ACTIVE|SUSPENDED, city, bio, phone + phoneVerifiedAt, emailVerifiedAt,
  activeListingLimit override)
- `Session` (refresh token hash, family id, expiresAt, revokedAt, rotatedAt, userAgent, ip)
- `Category` (self-referencing tree, slug unique, name, translations JSON, icon, sortOrder, isActive)
- `CategoryAttribute` (key, label, type TEXT|NUMBER|SELECT|BOOLEAN, options, unit, required, filterable, sortOrder)
  — effective attributes = own + all ancestors'
- `Brand` (+ many-to-many with categories), `ProductModel` (brand, optional category)
- `Listing` (seller, category, brand?, model?, title, description, priceAmount (kuruş), currency, condition, city, district,
  attributes JSON, allowsShipping, allowsInPerson, status, searchText (normalized), publishedAt, expiresAt, renewCount,
  moderation fields, viewCount)
- `ListingImage` (storageKey, url, width, height, sizeBytes, mimeType, position)
- `AuditLog` (actor, action, entityType, entityId, metadata JSON)

Indexes: `Listing(status, publishedAt)`, `Listing(categoryId, status)`, `Listing(sellerId, status)`, `Listing(city, status)`,
`Listing(priceAmount)`, GIN trigram index on `Listing.searchText` (raw SQL migration), `Category(parentId)`.

## 5. Search

Phase 1 uses PostgreSQL: `searchText` = `normalizeTurkish(title + brand + model + category + description excerpt)`;
queries are normalized the same way, split into tokens, each token matched with `ILIKE '%token%'` (AND), accelerated by the
`pg_trgm` GIN index. Turkish normalization lower-cases with Turkish rules (İ→i, I→ı) then folds diacritics
(ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u) so “istaka”, “ISTAKA” and “ıstaka” all match “Istaka”. Upgrade path: dedicated search engine
(Meilisearch/OpenSearch/Typesense) behind a `SearchService` interface once volume justifies it.

## 6. Media

`StorageDriver` interface (`put`, `delete`, `publicUrl`) with two implementations:
- `S3StorageDriver` — any S3-compatible store (Cloudflare R2 target). Credentials server-side only.
- `LocalStorageDriver` — **development substitute**, writes to `./.data/uploads` and serves via `/media/*`. Refuses to run when `NODE_ENV=production`.

Upload pipeline: multer memory storage with size cap → magic-byte sniff (JPEG/PNG/WebP/HEIC/AVIF) → sharp decode (rejects
corrupt files) → auto-rotate, strip metadata (EXIF/GPS), resize to ≤1600 px, re-encode WebP → store under random key.
Video (later): direct-to-storage presigned multipart upload + async transcoding worker.

## 7. Web & admin (Next.js App Router)

- Server components fetch public data from the API (`API_INTERNAL_URL`).
- Session: login/register route handlers call the API and store access + refresh tokens in **httpOnly, Secure, SameSite=Lax cookies**.
  Browser code never sees tokens. Client mutations call `/api/proxy/*`, which attaches the bearer token, transparently refreshes
  on 401, and forwards to the API (streams multipart uploads). CSRF: SameSite=Lax + same-origin check on mutating proxy requests.
- Tailwind CSS v4 with tokens from `@kleps/tokens` as CSS variables; dark mode via `prefers-color-scheme`.

## 8. Mobile (Expo)

Expo SDK 54 + Expo Router. Tokens in `expo-secure-store`; API via `@kleps/api-client` with refresh-on-401.
Photo upload via `expo-image-picker` → multipart to the API. Builds via EAS (not run in this environment).

## 9. Infrastructure (provisional, replaceable)

Web/admin → Vercel; API → Railway (Docker); PostgreSQL managed; media → Cloudflare R2; mobile → Expo EAS.
Local: `docker-compose.yml` (Postgres + Redis + MinIO) or a locally installed PostgreSQL.

## 10. Later-phase architecture notes

- **Payments:** `PaymentProvider` adapter (e.g. iyzico / PayTR / Param — licensed PSPs) with marketplace sub-merchant model; KLEPS
  never holds funds. Orders, disputes, refunds as separate module. Commission is a PSP split, not internal custody.
- **Messaging:** conversations per listing, WebSocket gateway + push notifications (Expo push), Redis pub/sub.
- **Jobs:** BullMQ on Redis for expiry sweeps, price-drop alerts, saved-search notifications, media processing.
  Phase 1 performs expiry lazily (queries filter on `expiresAt > now()`) and has an idempotent `expireListings` task.
- **Monetization:** `Product`/`Entitlement` model (extra capacity, featured, sponsored, subscriptions with tiers & benefits JSON).
- **Compliance:** `LegalDocument` versions + `UserConsent`; `DataSubjectRequest` workflow; retention jobs.
