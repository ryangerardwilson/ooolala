#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DEV_ENV="$ROOT/.dev/dev.env"
OOOLALA_HOME_VALUE="${OOOLALA_HOME:-$ROOT/.dev/ooolala-home}"

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
Run the Ooolala CLI against the local dev backend.

usage:
  scripts/dev/run-cli.sh auth <username>
  scripts/dev/run-cli.sh send <peer> "hello"
  scripts/dev/run-cli.sh tui
  scripts/dev/run-cli.sh web

notes:
  Start the dev servers first with scripts/dev/run-servers.sh.
  This helper reads .dev/dev.env and sets OOOLALA_API/OOOLALA_WEB_URL for the terminal client.
  Dev CLI state defaults to .dev/ooolala-home.
TXT
}

if [[ "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

cd "$ROOT"
ensure_node_deps

api_url="${OOOLALA_API:-}"
web_url="${OOOLALA_WEB_URL:-}"

if [[ -z "$api_url" || -z "$web_url" ]]; then
  if [[ ! -f "$DEV_ENV" ]]; then
    printf 'dev backend URL not found. Start servers first:\n  scripts/dev/run-servers.sh\n' >&2
    exit 1
  fi

  # shellcheck source=/dev/null
  source "$DEV_ENV"
  api_url="${api_url:-${OOOLALA_DEV_API_URL:-}}"
  web_url="${web_url:-${OOOLALA_DEV_WEB_URL:-}}"
fi

if [[ -z "$api_url" ]]; then
  printf 'dev backend URL missing from %s. Restart servers with scripts/dev/run-servers.sh\n' "$DEV_ENV" >&2
  exit 1
fi

if ! curl -fsS "$api_url/health" >/dev/null 2>&1; then
  printf 'dev backend is not reachable at %s. Start servers with scripts/dev/run-servers.sh\n' "$api_url" >&2
  exit 1
fi

if [[ "${1:-}" == "web" && -z "$web_url" ]]; then
  printf 'dev web URL missing from %s. Restart servers with scripts/dev/run-servers.sh\n' "$DEV_ENV" >&2
  exit 1
fi

mkdir -p "$OOOLALA_HOME_VALUE"
exec env \
  OOOLALA_API="$api_url" \
  OOOLALA_WEB_URL="$web_url" \
  OOOLALA_ENV=dev \
  OOOLALA_HOME="$OOOLALA_HOME_VALUE" \
  OOOLALA_COMMAND_HINT="scripts/dev/run-cli.sh" \
  OOOLALA_AUTH_HINT="scripts/dev/run-cli.sh auth <username>" \
  npm --silent --workspace apps/frontend/terminal run dev -- "$@"
