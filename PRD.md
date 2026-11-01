# KLEPS — Product Requirements Document

Status: living document. Brand: **KLEPS** · Target domain: kleps.app · Market: Türkiye · Language: Turkish (i18n-ready).

## 1. Problem & vision

Sports equipment buyers and sellers in Türkiye rely on general classifieds (sahibinden, letgo, Facebook groups) that do not
understand equipment specifics (e.g. cue tip diameter, dart barrel weight / tungsten ratio). KLEPS is a specialist,
premium, mobile-first marketplace that starts with tight communities (billiards and darts) and expands to all sports.

## 2. Users

| Persona | Need |
|---|---|
| Individual buyer | Find specific equipment fast, trust the seller, contact them |
| Individual seller | List used/new equipment quickly from a phone, with photos |
| Business seller | Manage inventory, a storefront, more listings |
| Verified professional seller | Public verification badge, storefront, subscriptions |
| Moderator / admin | Keep the marketplace safe: categories, moderation, reports, audit |

## 3. Platforms

iOS + Android (Expo), responsive web (Next.js), admin dashboard (Next.js). Shared backend (NestJS + PostgreSQL).

## 4. Phase 1 scope — Marketplace MVP (this phase)

Vertical slice (all must work end-to-end on real persisted data):

1. Register / log in (email + password), secure session management (short-lived access token, rotating refresh token).
2. Browse dynamic sports categories (tree) with category-specific attributes.
3. Create a listing as a **draft** (category, brand/model, title, description, price, condition, city/district, category attributes, delivery options).
4. Upload up to **15 photos** (magic-byte validated, re-encoded/optimized, ordered).
5. Persist to PostgreSQL.
6. Publish → risk-based moderation: low risk goes ACTIVE immediately; risky content goes to PENDING_REVIEW.
7. Listing visible on the web app.
8. Same listing visible on the mobile app.
9. Keyword search with Turkish character normalization + filters (category incl. descendants, brand, price, city, condition).
10. Listing detail + public seller profile.

Business rules in phase 1:

- Individual sellers: configurable limit of **10 active listings** (`LISTING_ACTIVE_LIMIT_INDIVIDUAL`), per-user override possible.
- Standard listings expire after **60 days** (`LISTING_EXPIRY_DAYS`) and can be renewed free of charge.
- Listing lifecycle: DRAFT → (PENDING_REVIEW) → ACTIVE → EXPIRED / SOLD / ARCHIVED; admins can REJECT / REMOVE.
- Only ACTIVE, non-expired listings are publicly visible. Owners and moderators can see their/all listings.

Admin (phase 1): login (role ≥ MODERATOR), moderation queue (approve / reject with reason / remove), listing search,
category management (create / edit / activate / deactivate, attributes), audit log view.

Out of phase 1 (documented, not built): payments, payouts, commissions, subscriptions, featured/sponsored listings, messaging,
reviews, Google/Apple sign-in, phone verification, video upload, saved searches, price-drop alerts, AI search.

## 5. Full product scope (architecture must accommodate)

**Accounts:** email, Google, Apple, phone verification, progressive verification (e.g. phone required before publishing more
than N listings or using checkout), individual / business / verified professional sellers.

**Marketplace:** dynamic categories + attributes, brand & model catalogs, new/used, drafts, moderation, expiration & renewal,
favorites, saved searches, seller profiles, professional storefronts, following, direct messaging, reporting.

**Media:** ≤15 photos, ≤1 video (configurable initial 100 MB, no arbitrary duration limit), optimization, ordering, secure validation.

**Search & discovery:** keyword search, Turkish normalization, dynamic filters, brand/model search, price & location filters,
personalized discovery, saved searches, price-drop notifications. Later: natural-language and image search.

**Commerce — three transaction models:** (1) secure platform checkout via a **licensed payment service provider** (seller pays
commission), (2) in-person, (3) independently arranged. No commission on off-platform transactions. KLEPS never holds funds
itself (no internal escrow / custody).

**Reputation:** verified-transaction reviews only (1–5 stars + text), public verification status, completed-transaction counts,
response-time indicators. No arbitrary numerical trust score.

**Monetization:** platform-checkout commission (seller pays), paid extra listing capacity, featured listings, sponsored search
results, category showcases, professional & storefront subscriptions (tiers, extra capacity, configurable benefits), advertising
packages (configurable 3/7/15-day durations).

**Safety & operations:** risk-based moderation, user reports, seller verification workflows, payment disputes, refunds, audit logs,
role-based admin permissions, contract (terms) versioning, privacy & data-subject request workflows.

## 6. Compliance requirements (explicit, not guarantees)

These are requirements to be validated with qualified Turkish legal counsel before launch. The codebase does **not** claim compliance.

- **KVKK** (Law No. 6698 on the Protection of Personal Data): privacy notice (aydınlatma metni), explicit consent where required,
  data-subject requests (access, correction, deletion), data minimization, retention policies, VERBİS registration assessment,
  cross-border transfer rules (hosting choice matters).
- **Law No. 6563 on the Regulation of Electronic Commerce** and related regulations: service-provider info, commercial electronic
  message consent (İYS), intermediary service provider obligations.
- **Law No. 6502 on Consumer Protection** and the Distance Contracts Regulation: applies to business sellers selling to consumers
  (pre-contract info, right of withdrawal) — relevant to platform checkout.
- **Payments:** Law No. 6493 — payment services / e-money must be provided by a licensed institution. KLEPS integrates a PSP.
- Terms of use and policies must be versioned and user acceptance recorded (contract versioning).

## 7. Non-functional requirements

Mobile-first responsive UI; accessibility (keyboard navigation, labels, contrast); Turkish localization; secure by default
(helmet, rate limiting, hashed passwords with argon2id, hashed refresh tokens, backend authorization); pagination on all list
endpoints; indexes where justified; migrations; seed data; replaceable infrastructure providers.

## 8. Design identity

Premium, modern, minimalist, sporty. Background `#F8F9FA`, text `#1E2329`, accent `#2563EB`, surfaces `#FFFFFF`,
borders `#E5E7EB`, dark background `#111827`. Temporary typographic **KLEPS** wordmark (not a final trademark asset).

## 9. Success criterion for milestone 1

A user can create a real listing and another user can retrieve and view that listing through the shared backend on both web and mobile.
