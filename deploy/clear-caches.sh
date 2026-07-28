#!/usr/bin/env bash
#
# Empties every cache and log the application owns, then reports what the
# server is actually serving.
#
# The report is the important half. When a deploy lands and the screens do
# not change, there are only two possible culprits — the server is still
# running old code, or the browser is still showing an old copy — and from
# a browser they are indistinguishable. Printing the bundle the server
# hands out settles it without guesswork.
#
# Touches no business data: caches, logs and compiled views only, all of
# which are rebuilt on demand.
set -uo pipefail

APP_PATH="${APP_PATH:?APP_PATH must be set to the application directory}"
cd "$APP_PATH"

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
[ -n "$PHP_BIN" ] || { echo "ERROR: no PHP >= 8.4 CLI found." >&2; exit 1; }

DOMAIN=$(sed -nE 's#^APP_URL=["'"'"']?https?://([^/"'"'"']+).*#\1#p' .env 2>/dev/null | head -1)
DOMAIN="${DOMAIN:-localhost}"

echo "== Clearing application caches"
"$PHP_BIN" artisan optimize:clear

echo
echo "== Emptying logs"
# Truncated rather than deleted: the log file's owner and permissions are
# what let PHP-FPM write to it, and a deleted file comes back owned by
# whoever recreates it first.
before=$(du -sh storage/logs 2>/dev/null | cut -f1)
find storage/logs -type f -name '*.log' -exec truncate -s 0 {} \; 2>/dev/null
echo "  storage/logs was $before, now $(du -sh storage/logs 2>/dev/null | cut -f1)"

echo
echo "== Clearing compiled views and framework caches"
find storage/framework/views -type f -name '*.php' -delete 2>/dev/null
find storage/framework/cache/data -mindepth 1 -delete 2>/dev/null
echo "  done"

echo
echo "== Resetting PHP's compiled-code cache"
# Laravel's caches and PHP's are different things. Where OPcache is told
# not to re-check file timestamps, PHP-FPM keeps executing the previous
# release's code even though the new files are on disk. The CLI has its
# own separate OPcache, so resetting from here would reset the wrong one —
# it has to be asked for inside the process that serves the site.
TOKEN="opcache-reset-$(date +%s%N).php"
trap 'rm -f "$APP_PATH/public/$TOKEN"' EXIT
printf '%s\n' '<?php echo function_exists("opcache_reset") ? (opcache_reset() ? "reset" : "failed") : "not-enabled";' \
    > "public/$TOKEN"
echo "  $(curl -sS -k -m 20 -H "Host: $DOMAIN" "https://127.0.0.1/$TOKEN" 2>/dev/null || echo unreachable)"
rm -f "public/$TOKEN"
trap - EXIT

echo
echo "== Rebuilding caches"
"$PHP_BIN" artisan config:cache
"$PHP_BIN" artisan route:cache
"$PHP_BIN" artisan view:cache

echo
echo "== What the server is serving right now"
echo "  app last deployed: $(date -r public/index.php 2>/dev/null || echo unknown)"
echo "  manifest built:    $(date -r public/build/manifest.json 2>/dev/null || echo 'no manifest')"
# The bundle named in the served HTML, taken from the server's own reply.
# If this matches the newest build, anything stale is in the browser.
served=$(curl -sS -k -m 20 -H "Host: $DOMAIN" "https://127.0.0.1/login" 2>/dev/null |
    grep -oE '/build/assets/main-[A-Za-z0-9_-]+\.js' | head -1)
echo "  bundle served:     ${served:-could not read}"
# Matched on the path alone: the manifest is pretty-printed, so anything
# anchored to `"file":"` breaks on the space after the colon.
built=$(grep -o 'assets/main-[A-Za-z0-9_-]*\.js' public/build/manifest.json 2>/dev/null | head -1)
built="${built:+/build/$built}"
echo "  bundle on disk:    ${built:-unknown}"

echo
if [ -n "$served" ] && [ "$served" = "$built" ]; then
    echo "MATCH  The server is serving the newest build. Anything old on screen"
    echo "       is cached in the browser — hard-reload, or unregister the"
    echo "       service worker under DevTools > Application."
else
    echo "MISMATCH  The server is not serving the build that is on disk."
    echo "          That is a server-side fault, not a browser one."
fi
