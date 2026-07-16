# Deploying to Hostinger Business Hosting

This app is a single Laravel application that serves a React SPA it builds
itself — there is nothing else to host. Hostinger's Business plan gives you
SSH access, cron jobs, and MySQL, but no Node.js runtime, so the frontend is
always built **before** it reaches the server (locally or via the
`Build Release Artifact` GitHub Actions workflow) and only the compiled
`public/build/*` assets are uploaded.

## 1. Build the release artifact

Either:

- Run the **Build Release Artifact** GitHub Actions workflow (Actions tab →
  select the workflow → Run workflow) and download the `pos-release`
  artifact, or
- Build locally:

  ```bash
  composer install --no-dev --optimize-autoloader
  npm ci && npm run build
  ```

  Then upload everything **except** `node_modules/`, `.git/`, and `tests/`.

## 2. Create the database

In hPanel → Databases → MySQL Databases, create a database and a user with
full privileges on it. Note the database name, username, password, and host
(usually `localhost`).

## 3. Upload the code

Upload the artifact via SFTP/SSH to a directory outside `public_html`, e.g.
`~/pos-app`. Keeping the app root outside the public webroot is safer than
placing Laravel's `app/`, `.env`, etc. directly in `public_html`.

## 4. Point the domain at `public/`

- **If your plan lets you set a custom document root** (hPanel → Websites →
  yourdomain.com → Advanced → set document root to `pos-app/public`), do
  that and skip to step 5.
- **If it does not**, symlink instead:

  ```bash
  rm -rf ~/public_html
  ln -s ~/pos-app/public ~/public_html
  ```

  (If `public_html` isn't empty/removable, move its contents aside first
  and confirm nothing important lives there before deleting it.)

## 5. Configure `.env`

SSH in and create `~/pos-app/.env` from `.env.example`, then set:

```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com
APP_LOCALE=en

DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=your_db_name
DB_USERNAME=your_db_user
DB_PASSWORD=your_db_password

SESSION_DRIVER=database
SESSION_DOMAIN=.yourdomain.com
QUEUE_CONNECTION=database
```

Same-origin deployments (SPA and API on the same domain, which is how this
app is built) do **not** need `SANCTUM_STATEFUL_DOMAINS` set.

## 6. Initialize the app

```bash
cd ~/pos-app
php artisan key:generate --force
php artisan migrate --force --seed
php artisan storage:link
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Fix permissions if needed so the PHP-FPM user can write to `storage/` and
`bootstrap/cache/`:

```bash
chmod -R 775 storage bootstrap/cache
```

**Log in immediately and change the default administrator password.** The
seeder creates `admin@example.com` / `password` so there's an account to log
in with on a fresh database — leaving it unchanged on a live deployment is a
real credential-exposure risk. Change it from the app's Settings page (bottom
of the sidebar → Change password) before sharing the URL with anyone else.

## 7. Set up the cron job

Hostinger's Business plan includes cron under hPanel → Advanced → Cron Jobs.
Add a single entry that runs every minute (Laravel's scheduler decides what
actually needs to run, including the period-closing auto-close command and
queued jobs):

```
* * * * * php /home/USERNAME/pos-app/artisan schedule:run >> /dev/null 2>&1
```

Confirm the exact PHP binary path with `which php` (or the versioned path,
e.g. `/usr/bin/php8.3`) over SSH — Hostinger sometimes requires the
versioned binary rather than a bare `php`.

## 8. Enable HTTPS

Turn on Hostinger's free Let's Encrypt SSL for the domain in hPanel, then
confirm the app forces HTTPS in production (already configured in
`AppServiceProvider`, since TLS terminates before requests reach PHP-FPM).

## Updating an existing deployment

```bash
# locally / in CI: rebuild the artifact, then on the server:
cd ~/pos-app
php artisan down
# upload new files here, then:
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan view:cache
php artisan up
```

Take a `mysqldump` backup before running migrations in production — this
app holds financial records (sales, purchases, ledgers, payroll), so a
failed migration should never be unrecoverable. Hostinger also offers
scheduled backups in hPanel; turn those on as a second line of defense.
