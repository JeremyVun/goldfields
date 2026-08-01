#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")/.."

# --- config (override via env) ----------------------------------------------
: "${CF_PAGES_PROJECT:=goldrush}"

PAGES_DIR=dist

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "error: set CLOUDFLARE_API_TOKEN (Cloudflare Pages Edit permission)" >&2
  echo "  https://dash.cloudflare.com/profile/api-tokens" >&2
  exit 1
fi

echo "==> build  (commit=$(git rev-parse --short=8 HEAD), dirty=$(git status --porcelain | wc -l | tr -d ' '))"
npm run build

echo "==> Cloudflare Pages  (project=$CF_PAGES_PROJECT)"
# Non-interactive: wrangler reads CLOUDFLARE_API_TOKEN (+ optional ACCOUNT_ID).
# --commit-dirty allows deploy from a dirty git tree (normal for local deploys).
npx --no-install wrangler pages deploy "$PAGES_DIR" \
  --project-name="$CF_PAGES_PROJECT" \
  --commit-dirty=true

echo "==> done"
echo "    shell:   Cloudflare Pages project '$CF_PAGES_PROJECT'"
