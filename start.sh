#!/usr/bin/env bash
# ============================================================
#  FirstStep - one-click launcher (macOS / Linux)
#  Run this file (./start.sh) to install deps, start the
#  engine's interface, and open it in your browser.
# ============================================================
set -e
cd "$(dirname "$0")"

if ! command -v bun >/dev/null 2>&1; then
  echo ""
  echo "  Bun is not installed. Install it from https://bun.sh then run this file again."
  echo ""
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  bun install
fi

echo ""
echo "  Starting FirstStep... the interface will open in your browser."
echo "  (If the page loads slowly, refresh once the server is up.)"
echo ""

# Open the browser shortly after the server starts
(sleep 3 && open http://localhost:5173 >/dev/null 2>&1 || xdg-open http://localhost:5173 >/dev/null 2>&1) &

bun run dev
