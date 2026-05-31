#!/usr/bin/env bash
set -euo pipefail

TARGET_ENV="${1:-dev}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${OOOLALA_EVIDENCE_DIR:-$ROOT/.evidence}"
SHA="$(git -C "$ROOT" rev-parse HEAD)"
SHORT_SHA="$(git -C "$ROOT" rev-parse --short=12 HEAD)"
STAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
TARGET_DIR="$OUT_DIR/$TARGET_ENV-$SHORT_SHA"
REPORT="$TARGET_DIR/report.md"

mkdir -p "$TARGET_DIR"

(
  cd "$ROOT"
  npm --workspace apps/frontend/terminal run build >/dev/null
  npm --workspace apps/frontend/terminal run snapshot > "$TARGET_DIR/tui-snapshot.txt"
  cp apps/frontend/web/src/components/contracts.ts "$TARGET_DIR/component-contracts.ts"

  if [[ -f apps/frontend/terminal/dist/index.js ]]; then
    node apps/frontend/terminal/dist/index.js help > "$TARGET_DIR/cli-help.txt"
    node apps/frontend/terminal/dist/index.js version > "$TARGET_DIR/cli-version.txt"
  else
    {
      printf 'CLI build artifact not found.\n'
      printf 'Run: npm --workspace apps/frontend/terminal run build\n'
    } > "$TARGET_DIR/cli-help.txt"
    printf 'not-built\n' > "$TARGET_DIR/cli-version.txt"
  fi
)

backend_status="not checked"
if [[ -n "${OOOLALA_BACKEND_URL:-}" ]]; then
  if curl -fsS "$OOOLALA_BACKEND_URL/health" > "$TARGET_DIR/backend-health.txt"; then
    backend_status="ok"
  else
    backend_status="failed"
  fi

  curl -fsS "$OOOLALA_BACKEND_URL/version" > "$TARGET_DIR/backend-version.json" || true
  curl -fsS "$OOOLALA_BACKEND_URL/version?format=text" > "$TARGET_DIR/backend-version.txt" || true
fi

web_status="not checked"
if [[ -n "${OOOLALA_WEB_URL:-}" ]]; then
  if curl -fsS "$OOOLALA_WEB_URL" > "$TARGET_DIR/web.html"; then
    web_status="ok"
  else
    web_status="failed"
  fi
fi

cat > "$REPORT" <<TXT
# Ooolala Deployment Evidence

- environment: $TARGET_ENV
- commit: $SHA
- generated: $STAMP
- backend_url: ${OOOLALA_BACKEND_URL:-not set}
- backend_health: $backend_status
- web_url: ${OOOLALA_WEB_URL:-not set}
- web_check: $web_status

## Artifacts

- cli-help.txt
- cli-version.txt
- backend-version.json
- backend-version.txt
- tui-snapshot.txt
- component-contracts.ts
TXT

printf '%s\n' "$TARGET_DIR"
