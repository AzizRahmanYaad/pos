# POS — Point of Sale & Business Management System

A Point-of-Sale and business-management web app: purchases and sales,
supplier/customer ledgers, expense tracking (including landed costs like
transport that raise stock cost), employee payroll, periodic accounting
"clearance" (period-end close), P&L/inventory/ledger reports, and a
dashboard. Supports English, Pashto, and Dari with full RTL layout, and
both Gregorian and Afghan solar Hijri (Jalali) calendars.

Backend: Laravel REST API. Frontend: React + TypeScript (Vite), built to
static assets and served directly by Laravel — one deployable PHP
application, no separate frontend host required. See
`deploy/HOSTINGER_DEPLOY.md` for deploying to Hostinger Business shared
hosting.

## Tech stack

- **Backend**: Laravel, MySQL (SQLite for local dev), Laravel Sanctum
  (SPA cookie auth), `spatie/laravel-permission` (roles), `mpdf/mpdf`
  (PDF receipts/reports with Arabic-script/RTL support).
- **Frontend**: React 18 + TypeScript, Vite, MUI (RTL-capable), TanStack
  Query, Zustand, `react-i18next`, Recharts, `jalaali-js`.

## Project structure

```
app/Domain/<Module>/{Actions,Services}/   business logic per module
app/Http/Controllers/Api/V1/              thin API controllers
lang/{en,ps,prs}/                         backend translations
resources/js/features/<module>/           React feature modules
resources/js/i18n/locales/{en,ps,prs}/    frontend translations
resources/views/app.blade.php             SPA shell (@vite entry)
deploy/                                   Hostinger deployment docs/script
```

## Local development

Requirements: PHP 8.3+, Composer, Node 20+, npm.

```bash
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate
npm install
composer run dev   # runs php artisan serve + queue:listen + vite dev, concurrently
```

Visit `http://localhost:8000`.

### Useful commands

```bash
php artisan test         # backend tests
npm run typecheck        # frontend TypeScript check
npm run build             # production frontend build
```

## Languages

The app ships English (`en`), Pashto (`ps`), and Dari (`prs`) from the
start, with Pashto/Dari rendered right-to-left. Backend strings live in
`lang/{en,ps,prs}/*.php`; frontend strings live in
`resources/js/i18n/locales/{en,ps,prs}/*.json`. The current translations
are a functional baseline covering core navigation/actions — a native
speaker should review them before relying on them for production content
covering every screen.

## Deployment

This app deploys as a single PHP application on shared hosting with no
Node.js runtime required at deploy time — the React build happens in CI or
locally, and only the compiled assets are uploaded. See
`deploy/HOSTINGER_DEPLOY.md` for the full walkthrough and `deploy/deploy.sh`
for a repeatable rsync+SSH deploy once a server is set up.
