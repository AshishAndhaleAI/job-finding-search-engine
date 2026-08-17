#!/usr/bin/env bash
# ============================================================
#  Freebuff preview launcher (dev:all)
#
#  Injects the gitignored local JWT signing key (.jwt-key) into
#  the Convex backend process, then starts both the Convex
#  backend (port 3210) and the Vite dev server (port 5173).
#
#  The local Convex backend does not read .env.local in this
#  sandbox, so the key is exported directly into its env.
# ============================================================
set -e
cd "$(dirname "$0")/.."

if [ -f .jwt-key ]; then
  export JWT_PRIVATE_KEY="$(cat .jwt-key)"
  # The local Convex backend only reads its deployment env store, not the
  # process env, so also register the key on the deployment itself.
  cat .jwt-key | bun convex env set JWT_PRIVATE_KEY || true
fi

bun convex dev &
bun run dev
