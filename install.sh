#!/usr/bin/env bash
set -euo pipefail

APP="${OOOLALA_APP:-ooolala}"
CHANNEL="${OOOLALA_CHANNEL:-prod}"
DEFAULT_API_URL="${OOOLALA_DEFAULT_API_URL:-https://ooolala.ryangerardwilson.com/api}"
INSTALL_BASE_URL="${OOOLALA_INSTALL_BASE_URL:-https://ooolala.ryangerardwilson.com}"
WELCOME_USER="${OOOLALA_WELCOME_USER:-bob}"
ROOT_DEFAULT="$HOME/.$APP"
INSTALL_ROOT="${OOOLALA_INSTALL_ROOT:-$ROOT_DEFAULT}"
PUBLIC_BIN_DIR="${OOOLALA_PUBLIC_BIN_DIR:-$HOME/.local/bin}"
INSTALL_URL="${OOOLALA_INSTALL_URL:-${INSTALL_BASE_URL%/}/install.sh}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_FILE="$SOURCE_DIR/VERSION"

usage() {
  cat <<'TXT'
Ooolala installer

global actions:
  ./install.sh help
    show this help
  ./install.sh version
    print the source version
  ./install.sh version <version>
    install only if the source version matches <version>
  ./install.sh upgrade
    rebuild and reinstall from the managed source checkout
TXT
}

version() {
  tr -d '[:space:]' < "$VERSION_FILE"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_go() {
  require_cmd go
}

run_quiet() {
  local label="$1"
  shift

  local log
  log="$(mktemp "${TMPDIR:-/tmp}/ooolala-install.XXXXXX")"

  if "$@" >"$log" 2>&1; then
    rm -f "$log"
    return 0
  fi

  local status=$?
  printf '%s failed:\n' "$label" >&2
  cat "$log" >&2
  rm -f "$log"
  exit "$status"
}

stop_old_daemons() {
  local pid state
  local states=("$ROOT_DEFAULT/daemon.env")

  if [[ -n "${OOOLALA_HOME:-}" ]]; then
    states+=("$OOOLALA_HOME/daemon.env")
  fi

  for state in "${states[@]}"; do
    if [[ -f "$state" ]]; then
      pid="$(awk -F= '$1 == "pid" {print $2; exit}' "$state")"
      if [[ -n "$pid" && "$pid" != "$$" ]]; then
        kill "$pid" 2>/dev/null || true
      fi
      rm -f "$state"
    fi
  done

  if command -v pgrep >/dev/null 2>&1; then
    while IFS= read -r pid; do
      if [[ -n "$pid" && "$pid" != "$$" ]]; then
        kill "$pid" 2>/dev/null || true
      fi
    done < <(pgrep -f 'Ooolala.CLI.NodeServer.start|ooolala-runtime .*__daemon__' 2>/dev/null || true)
  fi
}

copy_source() {
  local target="$INSTALL_ROOT/src"
  if [[ "$SOURCE_DIR" == "$target" ]]; then
    return 0
  fi

  local tmp="$INSTALL_ROOT/src.tmp"
  rm -rf "$tmp"
  mkdir -p "$tmp"
  tar \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='_build' \
    --exclude='deps' \
    --exclude='.next' \
    --exclude='dist' \
    -C "$SOURCE_DIR" -cf - . | tar -C "$tmp" -xf -
  rm -rf "$target"
  mv "$tmp" "$target"
}

build_cli() {
  local source="$INSTALL_ROOT/src"
  local current_version
  mkdir -p "$INSTALL_ROOT/bin" "$PUBLIC_BIN_DIR"
  require_go

  (
    cd "$source/apps/terminal"
    run_quiet "test terminal client" \
      go test ./...
    run_quiet "build terminal client" \
      go build -o "$INSTALL_ROOT/bin/ooolala-runtime" ./cmd/ooolala
  )

  chmod +x "$INSTALL_ROOT/bin/ooolala-runtime"
  current_version="$(version)"

  cat > "$PUBLIC_BIN_DIR/$APP" <<TXT
#!/usr/bin/env bash
set -euo pipefail

APP_VERSION="$current_version"
OOOLALA_APP="$APP"
OOOLALA_CHANNEL="$CHANNEL"
OOOLALA_INSTALL_ROOT="\${OOOLALA_INSTALL_ROOT:-$INSTALL_ROOT}"
OOOLALA_HOME="\${OOOLALA_HOME:-\$HOME/.$APP}"
export OOOLALA_HOME
export OOOLALA_APP
export OOOLALA_CHANNEL
export OOOLALA_INSTALL_ROOT
export OOOLALA_ENV="\${OOOLALA_ENV:-$CHANNEL}"
export OOOLALA_API="\${OOOLALA_API:-$DEFAULT_API_URL}"
export OOOLALA_INSTALL="\$OOOLALA_INSTALL_ROOT/src/install.sh"
export OOOLALA_INSTALL_URL="\${OOOLALA_INSTALL_URL:-$INSTALL_URL}"
export OOOLALA_SOURCE="\${OOOLALA_SOURCE:-\$OOOLALA_INSTALL_ROOT/src}"
export OOOLALA_WELCOME_USER="\${OOOLALA_WELCOME_USER:-$WELCOME_USER}"

exec "\$OOOLALA_INSTALL_ROOT/bin/ooolala-runtime" "\$@"
TXT
  chmod +x "$PUBLIC_BIN_DIR/$APP"
}

install_current() {
  stop_old_daemons
  copy_source
  build_cli
  printf 'installed %s %s (%s) to %s/%s\n' "$APP" "$(version)" "$CHANNEL" "$PUBLIC_BIN_DIR" "$APP"

  case ":$PATH:" in
    *":$PUBLIC_BIN_DIR:"*) ;;
    *)
      printf '\nadd this once if needed:\n'
      printf '  export PATH="%s:$PATH"\n' "$PUBLIC_BIN_DIR"
      ;;
  esac
}

if [[ $# -eq 0 ]]; then
  install_current
  exit 0
fi

case "${1:-}" in
  help)
    usage
    ;;
  version)
    if [[ $# -eq 1 ]]; then
      version
      exit 0
    fi
    requested="$2"
    current="$(version)"
    if [[ "$requested" != "$current" ]]; then
      printf 'requested %s but source is %s\n' "$requested" "$current" >&2
      exit 1
    fi
    install_current
    ;;
  upgrade)
    if [[ $# -ne 1 ]]; then
      printf 'invalid installer shape: use ./install.sh upgrade\n' >&2
      exit 1
    fi
    install_current
    ;;
  *)
    printf 'unknown installer command: %s\n' "$1" >&2
    printf 'use ./install.sh help\n' >&2
    exit 1
    ;;
esac
