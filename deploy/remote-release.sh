#!/usr/bin/env bash
#
# Finishes a release on the Hostinger server: run migrations, seed, rebuild
# derived data, and warm the framework caches.
#
# Lives in the repository rather than inside the workflow so it arrives on
# the server with the code it belongs to, can be read and run by hand when a
# deploy has to be finished manually, and can be retried by the workflow
# without duplicating twenty lines of shell in YAML.
#
# Every step here must be safe to run twice: a deploy that dies halfway
# through is retried, and a retry that corrupts the books would be worse
# than the failed deploy it was meant to rescue.
set -euo pipefail

APP_PATH="${APP_PATH:?APP_PATH must be set to the application directory}"
cd "$APP_PATH"

# Hostinger's default CLI php is ancient (7.4); find a PHP >= 8.4 binary among
# the versioned/alt-php paths, or use PHP_BIN when the caller already knows.
PHP_BIN="${PHP_BIN:-}"
if [ -z "$PHP_BIN" ]; then
    for candidate in php8.4 php84 /opt/alt/php84/usr/bin/php /usr/bin/php8.4 \
        /usr/local/bin/php8.4 php8.5 /opt/alt/php85/usr/bin/php php; do
        if command -v "$candidate" >/dev/null 2>&1 &&
            "$candidate" -r 'exit(PHP_VERSION_ID >= 80401 ? 0 : 1);' >/dev/null 2>&1; then
            PHP_BIN="$candidate"
            break
        fi
    done
fi

if [ -z "$PHP_BIN" ]; then
    echo "ERROR: no PHP >= 8.4 CLI found on the server. Set the HOSTINGER_PHP_BIN secret to the full path of a PHP 8.4 binary." >&2
    exit 1
fi

echo "Using PHP binary: $PHP_BIN"
"$PHP_BIN" -v | head -1

"$PHP_BIN" artisan migrate --force
"$PHP_BIN" artisan db:seed --force
"$PHP_BIN" artisan ledger:rebuild-balances
"$PHP_BIN" artisan storage:link || true
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

# Laravel's caches and PHP's own are different things. Where OPcache is
# configured not to re-check file timestamps, PHP-FPM goes on executing the
# previous release's code even though the new files are already on disk —
# the deploy reports success and nothing on screen changes. The CLI keeps a
# separate OPcache of its own, so resetting from here would clear the wrong
# one; it has to be asked for inside the process that serves the site.
DOMAIN=$(sed -nE 's#^APP_URL=["'"'"']?https?://([^/"'"'"']+).*#\1#p' "$APP_PATH/.env" 2>/dev/null | head -1)
TOKEN="opcache-reset-$(date +%s%N).php"
trap 'rm -f "$APP_PATH/public/$TOKEN"' EXIT
printf '%s\n' '<?php echo function_exists("opcache_reset") ? (opcache_reset() ? "reset" : "failed") : "not-enabled";' \
    > "$APP_PATH/public/$TOKEN"
echo "OPcache: $(curl -sS -k -m 20 -H "Host: ${DOMAIN:-localhost}" "https://127.0.0.1/$TOKEN" 2>/dev/null || echo unreachable)"
rm -f "$APP_PATH/public/$TOKEN"
trap - EXIT
