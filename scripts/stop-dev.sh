#!/usr/bin/env bash
set -euo pipefail

# stop-dev.sh — stop the local dev static server (port 3000) and backend (port 8000)
# Usage:
#   ./scripts/stop-dev.sh
# It finds processes listening on ports 3000 and 8000 and attempts to terminate them.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
cd "$ROOT_DIR"

PIDS_TO_KILL=""

echo "Looking for processes listening on ports 3000 and 8000..."
for PORT in 3000 8000; do
  if command -v lsof >/dev/null 2>&1; then
    # -t prints only pids; -iTCP:<port> -sTCP:LISTEN filters listening TCP sockets
    PIDS_ON_PORT=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN || true)
  else
    # fallback using ss + awk (may not be available on macOS)
    PIDS_ON_PORT=$(ss -ltnp 2>/dev/null | awk -v p=":"$PORT '$4 ~ p {print $6}' | sed 's/,.*//;s/.*pid=//g' || true)
  fi
  if [ -n "$PIDS_ON_PORT" ]; then
    echo "  port $PORT -> pids: $PIDS_ON_PORT"
    PIDS_TO_KILL="$PIDS_TO_KILL $PIDS_ON_PORT"
  else
    echo "  port $PORT -> none"
  fi
done

PIDS_TO_KILL=$(echo "$PIDS_TO_KILL" | xargs -n1 | sort -u | xargs || true)

if [ -z "$PIDS_TO_KILL" ]; then
  echo "No dev server processes found. Nothing to do."
  exit 0
fi

echo "Stopping processes: $PIDS_TO_KILL"
# Try graceful termination first
kill $PIDS_TO_KILL 2>/dev/null || true
sleep 0.6

# Force kill any remaining
for PID in $PIDS_TO_KILL; do
  if kill -0 "$PID" 2>/dev/null; then
    echo "Process $PID still running; sending SIGKILL"
    kill -9 "$PID" 2>/dev/null || true
  fi
done

echo "Done. You can verify with: lsof -iTCP -sTCP:LISTEN -P -n | grep -E ':(3000|8000)\\b' || true"
