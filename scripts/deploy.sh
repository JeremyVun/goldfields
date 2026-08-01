#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")/.."

# --- config (override via env) ----------------------------------------------
: "${VITE_ASSET_ORIGIN:=https://goldfields.syd1.cdn.digitaloceanspaces.com}"
: "${VITE_ANALYTICS_URL=https://analytics.jeremyvun.com}"
: "${SPACES_URI:=s3://goldfields/}"
: "${CF_PAGES_PROJECT:=goldfields}"
SPACES_URI="${SPACES_URI%/}"

PAGES_DIR=dist
: "${VITE_DATA_RELEASE:=$(date -u +%s)-$(git rev-parse --short=8 HEAD)}"
if [[ ! "$VITE_DATA_RELEASE" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]]; then
  echo "error: invalid VITE_DATA_RELEASE: $VITE_DATA_RELEASE" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "error: set CLOUDFLARE_API_TOKEN (Cloudflare Pages Edit permission)" >&2
  echo "  https://dash.cloudflare.com/profile/api-tokens" >&2
  exit 1
fi

echo "==> build  (VITE_ASSET_ORIGIN=$VITE_ASSET_ORIGIN, VITE_DATA_RELEASE=$VITE_DATA_RELEASE)"
export VITE_ASSET_ORIGIN
export VITE_DATA_RELEASE
export VITE_ANALYTICS_URL
npm run build

echo "==> Cloudflare Pages  (project=$CF_PAGES_PROJECT)"
# Non-interactive: wrangler reads CLOUDFLARE_API_TOKEN (+ optional ACCOUNT_ID).
# --commit-dirty allows deploy from a dirty git tree (normal for local deploys).
npx --yes wrangler pages deploy "$PAGES_DIR" \
  --project-name="$CF_PAGES_PROJECT" \
  --commit-dirty=true

echo "==> done"
echo "    content: $VITE_ASSET_ORIGIN"
echo "    shell:   Cloudflare Pages project '$CF_PAGES_PROJECT'"
