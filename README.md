# USE FIRST

Free, privacy-first household food inventory that helps you use food before it is wasted.

Scan a barcode, confirm the date, and USE FIRST keeps one shared inventory for your household. It tells you what to eat first, suggests recipes that use expiring ingredients, builds shopping lists, and shows what you saved and wasted. No ads, no data selling, no paid services.

## Features

- **Shared household inventory** — owner/admin/member roles, invitations, live stock levels, activity history.
- **Barcode and QR scanning** — camera scanning with `BarcodeDetector` when available and ZXing fallback; QR payloads are parsed for embedded GTINs or used as editable item names; GTIN check-digit validation.
- **Product lookup** — Open Food Facts name, brand, category and image, cached locally for 90 days with attribution.
- **Expiry OCR** — Tesseract.js runs locally in the browser. Dates are shown with their original text and confidence; low-confidence dates cannot be saved without confirmation.
- **Use-first ordering** — distinguishes `use_by` (safety) from `best_before` (quality), so a past best-before is never presented as unsafe.
- **Meals** — recipe catalogue, expiring-ingredient matching, dietary and time filters, cook/plan actions, missing ingredients to shopping list.
- **Shopping** — shared list, checked items, purchase into inventory, duplicate warning when an item is already at home.
- **Insights** — consumed vs wasted, waste reasons, value estimates, weekly trend, recent waste.
- **In-app notifications** — expiring food and shopping reminders derived from current data.
- **EN / Norwegian Bokmål**, metric/imperial, currency and household serving preferences.
- **Data control** — JSON export and account deletion from Settings.
- **PWA** — installable, offline fallback page, local-first OCR and barcode work.

## Quick start

Requirements: Node.js 22+ (tested with Node 24), npm.

```bash
npm install
cp .env.example .env.local
npm run db:seed
npm run dev
```

Open http://localhost:3000, create an account, and create a household. The seed adds the recipe catalogue, not demo user data.

The database is embedded PostgreSQL via PGlite and is created automatically on first request. Default location: `./data/pglite`.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | request origin | Public origin used for invitation links |
| `PGLITE_DATA_DIR` | `./data/pglite` | PGlite data directory |
| `SESSION_TTL_DAYS` | `30` | Session lifetime |
| `COOKIE_SECURE` | auto | Force `Secure` session cookies. Auto-detects `x-forwarded-proto: https` or an HTTPS `NEXT_PUBLIC_APP_URL` |
| `NEXT_OUTPUT` | unset | Set to `standalone` for the Docker build |

Never commit `.env.local` or the `data/` directory.

## Scripts

```bash
npm run dev        # development server
npm run build      # production build
npm start          # production server
npm run typecheck  # TypeScript
npm test           # unit tests (Vitest)
npm run test:e2e   # Playwright (install browsers first)
npm run db:seed    # seed recipe catalogue (idempotent)
npm run db:reset   # delete the local database (stop the app first)
```

First-time E2E setup:

```bash
npx playwright install chromium
```

## Architecture

- **Next.js 15 App Router + React 19 + TypeScript**
- **Tailwind CSS** with small local UI primitives; Lucide icons
- **PGlite + Drizzle ORM** — embedded PostgreSQL, custom SQL migration runner
- **Zod** validation at every API boundary
- **Custom session auth** — scrypt password hashes, SHA-256 token hashes, HttpOnly `SameSite=Lax` cookie
- **Tesseract.js** and **ZXing** in the browser; no image upload for OCR
- **Open Food Facts** for product lookup only

Key paths:

```
src/app/(app)/          authenticated pages
src/app/api/            route handlers
src/features/           client feature modules
src/lib/database/       schema, PGlite singleton, migration runner
src/lib/auth/           password and session helpers
src/lib/permissions/    household role checks
src/lib/date-recognition/ expiry parsing and confidence scoring
src/lib/meals/          ingredient matching and recipe ranking
database/migrations/    canonical SQL schema
scripts/seed.ts         recipe catalogue
tests/                  Vitest unit tests and Playwright E2E
```

### Data model

`users`, `households`, `household_members`, `household_invitations`, `user_preferences`, `products`, `inventory`, `inventory_events`, `food_waste_records`, `shopping_lists`, `shopping_list_items`, `recipes`, `recipe_ingredients`, `meal_plans`, `notifications`, `audit_logs`, `_migrations`.

Inventory rows carry `quantity`, `unit`, `storage_location`, `date_value`, `date_type`, `original_date_text`, `date_confidence`, `version` (optimistic concurrency), and audit fields.

## Date safety

The app deliberately does not invent or silently guess expiry dates.

- `use_by` is a safety date. Past use-by items are flagged and excluded from recipe recommendations.
- `best_before` is a quality date. Past items are shown as “check today”, not as unsafe.
- OCR keeps `original_date_text` and a confidence score. Ambiguous day/month order is marked ambiguous; month/year-only labels assume the last day of the month and stay low confidence.
- The API rejects dates with `date_confidence: "low"` or `"none"`, and rejects a date without a use-by/best-before type. Users must confirm or type the date manually.

Scanning limits are stated in the UI: group scanning cannot guarantee correct date-to-barcode assignment when labels overlap or are obscured. Review before saving.

## Privacy and security

- Product lookup sends only the barcode to Open Food Facts; no account or household data.
- OCR images stay in the browser.
- No analytics, ads, trackers, or third-party auth.
- Passwords use scrypt with per-user salts; sessions store only token hashes.
- Household access is checked server-side on every inventory, list, meal, insight and member operation.
- Same-origin checks, rate limiting, security headers and a restrictive CSP are enabled.
- Export and deletion are available in Settings.

## Docker

```bash
docker compose up --build
```

Data persists in the `use-first-data` volume. Set `NEXT_PUBLIC_APP_URL` for correct invitation links. Behind an HTTPS reverse proxy, forward `X-Forwarded-Proto: https` (or set `COOKIE_SECURE=true`) so session cookies are marked `Secure`. The container runs as a non-root user and exposes `/api/health`.

## Testing

```bash
npm test
npm run typecheck
npm run build
```

Unit coverage focuses on expiry parsing/confidence, date-safety validation, priority ordering, ingredient matching and recipe ranking, barcode/QR payload parsing, and household role rules. Playwright covers registration, household creation, and adding a manual item.

## Known limitations

- One household per user for the MVP.
- PGlite is a single-process embedded database. Run one app instance; use PostgreSQL for horizontal scaling.
- Rate limiting is in-memory per process.
- Invitations are link-based; no email delivery is configured.
- “Notifications” are in-app and computed from current data. Browser permission is requested, but no background push service is included.
- Product data quality depends on Open Food Facts; missing products fall back to manual entry.
- Date OCR supports common numeric and English/Norwegian/German/French/Spanish month formats, not every packaging layout.

## Deviations from the original brief

- **Custom session auth instead of Auth.js** — fewer moving parts and no external provider; same security properties for this scope (scrypt, hashed tokens, HttpOnly cookie).
- **PGlite instead of a separate PostgreSQL service** — makes self-hosting a single process. Schema and queries stay PostgreSQL-compatible.
- **No email provider** — invitation links are copied/shared manually.

## Attribution

Product data from [Open Food Facts](https://world.openfoodfacts.org/) under the Open Database License (ODbL). USE FIRST is not affiliated with Open Food Facts.
