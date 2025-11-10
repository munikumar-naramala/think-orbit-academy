#!/usr/bin/env bash
set -euo pipefail

# start-dev.sh — small helper to run the static frontend and the FastAPI backend for local dev
# Usage:
#   ./scripts/start-dev.sh
# It will source backend/.env if present (so you can keep GOOGLE_CLIENT_ID there),
# require GOOGLE_CLIENT_ID to be set, then start a static HTTP server on port 3000
# and uvicorn backend on port 8000. Ctrl-C will stop both.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

# Load backend/.env if present
if [ -f backend/.env ]; then
  # shellcheck disable=SC1090
  set -o allexport
  source backend/.env
  set +o allexport
fi

if [ -z "${GOOGLE_CLIENT_ID:-}" ]; then
  echo "ERROR: GOOGLE_CLIENT_ID not set. Export it or add it to backend/.env"
  echo "Create a Google OAuth client ID and set GOOGLE_CLIENT_ID=..."
  exit 1
fi

FRONTEND_PORT="${FRONTEND_PORT:-3000}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

echo "Starting static frontend on http://localhost:$FRONTEND_PORT"
# serve project root (so index.html and edu-app.html are reachable)
python3 -m http.server "$FRONTEND_PORT" --directory . &
FRONTEND_PID=$!

echo "Starting backend (uvicorn) on http://localhost:$BACKEND_PORT"
# If a .venv exists, try to activate it
if [ -f .venv/bin/activate ]; then
  # shellcheck disable=SC1091
  source .venv/bin/activate
fi

uvicorn backend.main:app --reload --port "$BACKEND_PORT" &
BACKEND_PID=$!

cleanup() {
  echo "Stopping servers..."
  kill "$FRONTEND_PID" "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  exit 0
}

trap cleanup INT TERM

wait
