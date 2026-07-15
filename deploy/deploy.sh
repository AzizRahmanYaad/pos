#!/usr/bin/env bash
# Rebuilds the app and syncs it to a Hostinger Business SSH target.
#
# Usage:
#   deploy/deploy.sh user@yourdomain.com:/home/user/pos-app
#
# Requires: local composer + node/npm, and passwordless SSH access to the
# target already set up. See deploy/HOSTINGER_DEPLOY.md for first-time
# server setup (database, .env, cron, document root) — this script only
# handles rebuilding and syncing files for subsequent deploys.

set -euo pipefail

TARGET="${1:?Usage: deploy/deploy.sh user@host:/path/to/pos-app}"

echo "==> Installing production PHP dependencies"
composer install --no-dev --optimize-autoloader --prefer-dist --no-interaction

echo "==> Installing frontend dependencies and building assets"
npm ci
npm run build

echo "==> Syncing files to $TARGET"
rsync -avz --delete \
    --exclude='.git' \
    --exclude='.github' \
    --exclude='node_modules' \
    --exclude='tests' \
    --exclude='.env' \
    --exclude='storage/framework/cache/data' \
    --exclude='storage/framework/sessions' \
    --exclude='storage/framework/views' \
    --exclude='storage/logs' \
    ./ "$TARGET"/

REMOTE_HOST="${TARGET%%:*}"
REMOTE_PATH="${TARGET#*:}"

echo "==> Running remote migration/cache steps"
ssh "$REMOTE_HOST" "cd '$REMOTE_PATH' && php artisan down || true \
    && php artisan migrate --force \
    && php artisan config:cache \
    && php artisan route:cache \
    && php artisan view:cache \
    && php artisan up"

echo "==> Deploy complete"
