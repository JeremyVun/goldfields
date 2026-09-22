#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")/.."

# --- config (override via env) ----------------------------------------------
: "${CF_PAGES_PROJECT:=goldrush}"

PAGES_DIR=dist

if [[ -n "$(git status --porcelain)" ]]; then
  echo "error: commit or resolve the working-tree changes before deploying" >&2
  exit 1
fi

if [[ "$(git branch --show-current)" != main ]]; then
  echo "error: production deploys must run from main" >&2
  exit 1
fi

git fetch origin main
if [[ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]]; then
  echo "error: main must match origin/main before deploying" >&2
  exit 1
fi

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  echo "error: set CLOUDFLARE_API_TOKEN (Cloudflare Pages Edit permission)" >&2
  echo "  https://dash.cloudflare.com/profile/api-tokens" >&2
  exit 1
fi

echo "==> build  (commit=$(git rev-parse --short=8 HEAD))"
npm run build

echo "==> Cloudflare Pages  (project=$CF_PAGES_PROJECT)"
# Non-interactive: wrangler reads CLOUDFLARE_API_TOKEN (+ optional ACCOUNT_ID).
npx --no-install wrangler pages deploy "$PAGES_DIR" \
  --project-name="$CF_PAGES_PROJECT" \
  --branch=main \
  --commit-dirty=false

echo "==> done"
echo "    shell:   Cloudflare Pages project '$CF_PAGES_PROJECT'"
