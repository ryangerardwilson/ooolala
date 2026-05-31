#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATABASE_URL="${DATABASE_URL:-postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev}"
OOOLALA_STORE="${OOOLALA_STORE:-postgres}"
PORT="${PORT:-}"
WEB_PORT="${WEB_PORT:-}"
DEV_DIR="$ROOT/.dev"
DEV_ENV="$DEV_DIR/dev.env"
BACKEND_LOG="$DEV_DIR/backend.log"
WEB_LOG="$DEV_DIR/web.log"

ensure_node_deps() {
  if [[ -x "$ROOT/node_modules/.bin/tsx" && -x "$ROOT/node_modules/.bin/vite" && -x "$ROOT/node_modules/.bin/tsc" ]]; then
    return 0
  fi

  command -v node >/dev/null 2>&1 || {
    printf 'missing required command: node\n' >&2
    exit 1
  }

  command -v npm >/dev/null 2>&1 || {
    printf 'missing required command: npm\n' >&2
    exit 1
  }

  printf '==> node deps\n'
  (
    cd "$ROOT"
    npm ci
  )
}

usage() {
  cat <<TXT
Run the local Ooolala dev stack.

usage:
  scripts/dev/run-servers.sh

env:
  PORT=4002
    force the backend port; default picks the first free port from 4000..4020
  WEB_PORT=5174
    force the web port; default picks the first free port from 5173..5193
  DATABASE_URL=$DATABASE_URL
    local Postgres URL

starts:
  - Docker Postgres
  - Elixir backend with open dev auth
  - React/Vite web app pointed at the local backend

then use:
  scripts/dev/run-cli.sh auth <username>
TXT
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

mkdir -p "$DEV_DIR"
ensure_node_deps

port_open() {
  local port="$1"
  timeout 1 bash -c "</dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
}

pick_port() {
  if [[ -n "$PORT" ]]; then
    if port_open "$PORT"; then
      printf 'PORT=%s is already in use. Pick another port, for example: PORT=4002 scripts/dev/run-servers.sh\n' "$PORT" >&2
      exit 1
    fi

    printf '%s\n' "$PORT"
    return
  fi

  for candidate in $(seq 4000 4020); do
    if ! port_open "$candidate"; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  printf 'no free backend port found in 4000..4020. Set PORT explicitly.\n' >&2
  exit 1
}

BACKEND_PORT="$(pick_port)"
API_URL="http://127.0.0.1:$BACKEND_PORT"
pick_web_port() {
  if [[ -n "$WEB_PORT" ]]; then
    if port_open "$WEB_PORT"; then
      printf 'WEB_PORT=%s is already in use. Pick another port, for example: WEB_PORT=5174 scripts/dev/run-servers.sh\n' "$WEB_PORT" >&2
      exit 1
    fi

    printf '%s\n' "$WEB_PORT"
    return
  fi

  for candidate in $(seq 5173 5193); do
    if ! port_open "$candidate"; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  printf 'no free web port found in 5173..5193. Set WEB_PORT explicitly.\n' >&2
  exit 1
}

WEB_PORT="$(pick_web_port)"
WEB_URL="http://127.0.0.1:$WEB_PORT/"
backend_pid=""
web_pid=""

cleanup() {
  trap - INT TERM EXIT

  for pid in "$web_pid" "$backend_pid"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done

  wait "$web_pid" "$backend_pid" >/dev/null 2>&1 || true
}

trap cleanup INT TERM EXIT

printf '==> postgres\n'
docker compose -f "$ROOT/compose.yaml" up -d postgres

until docker compose -f "$ROOT/compose.yaml" exec -T postgres pg_isready -U ooolala -d ooolala_dev >/dev/null 2>&1; do
  sleep 1
done

printf '==> migrate\n'
(
  cd "$ROOT/apps/backend"
  OOOLALA_STORE="$OOOLALA_STORE" DATABASE_URL="$DATABASE_URL" mix ooolala.db.migrate
)

: > "$BACKEND_LOG"
printf '==> backend %s\n' "$API_URL"
(
  cd "$ROOT/apps/backend"
  exec env \
    PORT="$BACKEND_PORT" \
    OOOLALA_ENV=dev \
    OOOLALA_OPEN_SIGNUP=1 \
    OOOLALA_BACKEND_HTTP=1 \
    OOOLALA_STORE="$OOOLALA_STORE" \
    DATABASE_URL="$DATABASE_URL" \
    mix run --no-halt
) > "$BACKEND_LOG" 2>&1 &
backend_pid="$!"

for _ in $(seq 1 60); do
  if curl -fsS "$API_URL/health" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$backend_pid" >/dev/null 2>&1; then
    printf 'backend exited early; log follows:\n' >&2
    tail -80 "$BACKEND_LOG" >&2 || true
    exit 1
  fi

  sleep 0.5
done

if ! curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  printf 'backend did not become healthy; log follows:\n' >&2
  tail -80 "$BACKEND_LOG" >&2 || true
  exit 1
fi

: > "$WEB_LOG"
printf '==> web %s\n' "$WEB_URL"
(
  cd "$ROOT"
  exec env VITE_OOOLALA_API_URL="$API_URL" npm --workspace apps/frontend/web run dev -- --port "$WEB_PORT" --strictPort
) > "$WEB_LOG" 2>&1 &
web_pid="$!"

for _ in $(seq 1 60); do
  if curl -fsS "$WEB_URL" >/dev/null 2>&1; then
    break
  fi

  if ! kill -0 "$web_pid" >/dev/null 2>&1; then
    printf 'web exited early; log follows:\n' >&2
    tail -80 "$WEB_LOG" >&2 || true
    exit 1
  fi

  sleep 0.5
done

if ! curl -fsS "$WEB_URL" >/dev/null 2>&1; then
  printf 'web did not become healthy; log follows:\n' >&2
  tail -80 "$WEB_LOG" >&2 || true
  exit 1
fi

cat > "$DEV_ENV" <<TXT
OOOLALA_DEV_API_URL=$API_URL
OOOLALA_DEV_WEB_URL=$WEB_URL
OOOLALA_DEV_HOME=$DEV_DIR/ooolala-home
OOOLALA_DEV_BACKEND_LOG=$BACKEND_LOG
OOOLALA_DEV_WEB_LOG=$WEB_LOG
TXT

cat <<TXT

ooolala dev is running

web:
  $WEB_URL

backend:
  $API_URL

dev cli:
  scripts/dev/run-cli.sh auth <username>
  scripts/dev/run-cli.sh send <peer> "hello"
  scripts/dev/run-cli.sh tui

logs:
  backend: $BACKEND_LOG
  web:     $WEB_LOG

dev state:
  $DEV_DIR/ooolala-home

stop:
  press Ctrl+C

TXT

wait -n "$backend_pid" "$web_pid"
