# CLAUDE.md — Working agreement for KLEPS

KLEPS is a mobile-first sports equipment marketplace for Türkiye (Turkish-first, billiards + darts initially).
Read these before changing anything:

- `PRD.md` — what we are building and why
- `ARCHITECTURE.md` — how the system is structured
- `ROADMAP.md` — phases and the ordered task backlog with acceptance criteria
- `DECISIONS.md` — architecture decision records (append-only)
- `PROGRESS.md` — **source of truth** for current status, test results, defects, blockers

## Repository layout

```
apps/api      NestJS REST API (port 4000)          — owns all business rules + authorization
apps/web      Next.js public web app (port 3000)   — BFF: httpOnly cookie session, proxies to API
apps/admin    Next.js admin dashboard (port 3001)  — same BFF pattern, admin roles only
apps/mobile   Expo (React Native) app              — talks to API directly, tokens in SecureStore
packages/shared      zod schemas (API contracts), shared types, utils (Turkish normalization, money, slug, cities)
packages/db          Prisma schema, migrations, seed, Prisma client export
packages/api-client  typed fetch client used by web, admin and mobile
packages/tokens      design tokens (colors, spacing, radii, typography) + generated CSS variables
packages/i18n        locale files (tr = primary) and a tiny typed `t()` helper
```

## Commands

```bash
pnpm install
pnpm db:migrate        # prisma migrate dev (local)
pnpm db:seed           # categories, attributes, brands, models (+ demo data if SEED_DEMO=true)
pnpm dev               # all apps via turbo
pnpm build | typecheck | lint | test
pnpm test:integration  # API integration tests against DATABASE_URL_TEST
pnpm test:e2e          # Playwright web end-to-end (requires api + web running or uses webServer config)
```

## Rules

1. Strict TypeScript everywhere. No `any` unless justified in a comment.
2. All request bodies / queries are validated with zod schemas from `@kleps/shared`. Never duplicate a schema.
3. Authorization is enforced in the API only. UI checks are cosmetic.
4. Uploaded files are validated by magic bytes + size and re-encoded with sharp. Never trust the client MIME type.
5. Money is stored as integer kuruş (`priceAmount`), currency `TRY`.
6. Never commit secrets. `.env` is git-ignored; update `.env.example` when adding variables.
7. No payments, escrow, fund custody, fake verification or fake delivery confirmation. Payment work must go through a licensed PSP adapter (later phase).
8. Every DB change goes through a Prisma migration. Raw SQL (e.g. trigram indexes) lives in migration files.
9. User-facing copy goes in `packages/i18n/locales/tr.json`; do not hardcode Turkish strings in components where avoidable.
10. Small commits; update `PROGRESS.md` after each completed task with real test results. Never fabricate results or percentages.
11. Don't redesign the architecture; record genuine changes in `DECISIONS.md`.
