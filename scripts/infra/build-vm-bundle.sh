#!/usr/bin/env bash
set -euo pipefail

TARGET_STACK="${1:-${OOOLALA_VM_STACK:-prod}}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

if [[ ! "$TARGET_STACK" =~ ^[a-z0-9][a-z0-9_-]{0,63}$ ]]; then
  printf 'invalid VM stack: %s\n' "$TARGET_STACK" >&2
  exit 2
fi

DIRTY_SUFFIX=""

if [[ -z "${OOOLALA_IMAGE_TAG:-}" && -z "${GITHUB_SHA:-}" ]]; then
  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    if [[ "${OOOLALA_ALLOW_DIRTY_BUNDLE:-}" != "1" ]]; then
      printf 'refusing to build a deploy bundle from a dirty worktree\n' >&2
      printf 'commit or stash changes first, or set OOOLALA_ALLOW_DIRTY_BUNDLE=1 for a disposable local bundle\n' >&2
      exit 1
    fi

    DIRTY_SUFFIX="-dirty"
  fi
fi

COMMIT="${OOOLALA_IMAGE_TAG:-${GITHUB_SHA:-$(git -C "$ROOT" rev-parse --short=12 HEAD)${DIRTY_SUFFIX}}}"
BUILD_ROOT="${OOOLALA_VM_BUILD_DIR:-$ROOT/.deploy/vm/$TARGET_STACK}"
WORK="$BUILD_ROOT/work"
BUNDLE="$BUILD_ROOT/ooolala-vm-bundle.tar.gz"
RUNTIME_ENV="${OOOLALA_VM_ENVIRONMENT:-prod}"
WEB_API_URL="${OOOLALA_VM_WEB_API_URL:-/api}"
PUBLIC_URL="${OOOLALA_VM_PUBLIC_URL:?set OOOLALA_VM_PUBLIC_URL before building a hosted VM bundle}"
PUBLIC_API_URL="${OOOLALA_PUBLIC_API_URL:-${PUBLIC_URL%/}/api}"
INSTALL_APP="${OOOLALA_INSTALL_APP:-ooolala}"
WELCOME_USER="${OOOLALA_WELCOME_USER:-bob}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd npm
require_cmd tar
require_cmd git
require_cmd gzip

deterministic_tgz() {
  local output="$1"
  shift

  tar \
    --sort=name \
    --mtime='UTC 2020-01-01' \
    --owner=0 \
    --group=0 \
    --numeric-owner \
    -cf - "$@" | gzip -n > "$output"
}

rm -rf "$WORK"
mkdir -p "$WORK/source" "$WORK/web"

(
  cd "$ROOT"
  VITE_OOOLALA_API_URL="$WEB_API_URL" \
    VITE_OOOLALA_BUILD_ID="$COMMIT" \
    VITE_OOOLALA_APP_NAME="$INSTALL_APP" \
    VITE_OOOLALA_WELCOME_USER="$WELCOME_USER" \
    VITE_OOOLALA_INSTALL_COMMAND="curl -fsSL ${PUBLIC_URL%/}/install.sh | bash" \
    npm --workspace apps/frontend/web run build
)

(
  cd "$ROOT"
  tar \
    --exclude='apps/backend/_build' \
    --exclude='apps/backend/deps' \
    --exclude='apps/frontend/terminal/dist' \
    --exclude='apps/frontend/web/dist' \
    --exclude='*.tsbuildinfo' \
    -cf - VERSION SKILLS.md package.json package-lock.json install.sh .dockerignore docker/backend.Dockerfile apps/backend apps/frontend \
    | tar -C "$WORK/source" -xf -
)

cp -a "$ROOT/apps/frontend/web/dist/." "$WORK/web/"
(
  cd "$WORK/source"
  deterministic_tgz "$WORK/web/ooolala-source.tar.gz" VERSION SKILLS.md package.json package-lock.json install.sh .dockerignore docker/backend.Dockerfile apps/backend apps/frontend
)
cat > "$WORK/web/install.sh" <<TXT
#!/usr/bin/env bash
set -euo pipefail

base_url="\${OOOLALA_INSTALL_BASE_URL:-$PUBLIC_URL}"
api_url="\${OOOLALA_API:-$PUBLIC_API_URL}"
app="\${OOOLALA_APP:-$INSTALL_APP}"
welcome_user="\${OOOLALA_WELCOME_USER:-$WELCOME_USER}"
channel="\${OOOLALA_CHANNEL:-$RUNTIME_ENV}"
install_root="\${OOOLALA_INSTALL_ROOT:-\$HOME/.\$app}"
tmp="\$(mktemp -d)"
trap 'rm -rf "\$tmp"' EXIT

curl -fsSL "\${base_url%/}/ooolala-source.tar.gz" -o "\$tmp/ooolala-source.tar.gz"
mkdir -p "\$tmp/source"
tar -xzf "\$tmp/ooolala-source.tar.gz" -C "\$tmp/source"

(
  cd "\$tmp/source"
  OOOLALA_APP="\$app" \\
    OOOLALA_CHANNEL="\$channel" \\
    OOOLALA_INSTALL_ROOT="\$install_root" \\
    OOOLALA_DEFAULT_API_URL="\$api_url" \\
    OOOLALA_DEFAULT_WEB_URL="\$base_url" \\
    OOOLALA_WELCOME_USER="\$welcome_user" \\
    OOOLALA_INSTALL_URL="\${base_url%/}/install.sh" \\
    ./install.sh "\$@"
)
TXT
chmod +x "$WORK/web/install.sh"
printf '%s\n' "$COMMIT" > "$WORK/commit.txt"

mkdir -p "$BUILD_ROOT"
(
  cd "$WORK"
  deterministic_tgz "$BUNDLE" source web commit.txt
)

printf 'bundle=%s\n' "$BUNDLE"
printf 'commit=%s\n' "$COMMIT"
printf 'install_app=%s\n' "$INSTALL_APP"
