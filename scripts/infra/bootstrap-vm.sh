#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TARGET="${1:-}"
CHECK_ONLY=false

usage() {
  cat <<'EOF'
usage: scripts/infra/bootstrap-vm.sh help
usage: scripts/infra/bootstrap-vm.sh prod [check]

Prepare an Ubuntu/Debian VM for Ooolala deployment:
  - Docker Engine and Docker Compose plugin
  - nginx
  - certbot
  - curl
  - /opt/ooolala owned by the deploy user

The target host/user/key/domain come from infra/vm/environments/*.sh.
EOF
}

if [[ "$TARGET" == "help" ]]; then
  usage
  exit 0
fi

if [[ -z "$TARGET" ]]; then
  usage
  exit 2
fi
shift

while (($#)); do
  case "$1" in
    check)
      CHECK_ONLY=true
      ;;
    -*)
      printf 'unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      printf 'unexpected argument: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
  shift
done

case "$TARGET" in
  prod)
    # shellcheck source=../../infra/vm/environments/prod.sh
    source "$ROOT/infra/vm/environments/prod.sh"
    ;;
  *)
    printf 'unknown VM target: %s\n' "$TARGET" >&2
    usage >&2
    exit 2
    ;;
esac

for cmd in ssh; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$cmd" >&2
    exit 1
  fi
done

if [[ -z "${OOOLALA_VM_SSH_KEY:-}" ]]; then
  printf 'OOOLALA_VM_SSH_KEY is required and should point to a private key under ~/.ssh\n' >&2
  exit 1
fi

if [[ ! -f "$OOOLALA_VM_SSH_KEY" ]]; then
  printf 'VM SSH key not found: %s\n' "$OOOLALA_VM_SSH_KEY" >&2
  exit 1
fi

REMOTE="${OOOLALA_VM_USER}@${OOOLALA_VM_HOST}"
SSH_PORT="${OOOLALA_VM_SSH_PORT:-22}"
SSH_OPTS=(
  -i "$OOOLALA_VM_SSH_KEY"
  -p "$SSH_PORT"
  -o IdentitiesOnly=yes
  -o StrictHostKeyChecking=accept-new
)

if [[ "$CHECK_ONLY" == "true" ]]; then
  ssh "${SSH_OPTS[@]}" "$REMOTE" \
    'set -e; command -v docker; docker compose version; command -v nginx; command -v certbot; command -v curl'
  exit 0
fi

ssh "${SSH_OPTS[@]}" "$REMOTE" 'bash -s' -- "$OOOLALA_VM_USER" "$OOOLALA_VM_REMOTE_ROOT" <<'REMOTE_BOOTSTRAP'
set -euo pipefail

DEPLOY_USER="$1"
REMOTE_ROOT="$2"

if ! command -v apt-get >/dev/null 2>&1; then
  printf 'bootstrap-vm currently expects an apt-based Ubuntu/Debian server\n' >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg nginx certbot python3-certbot-nginx

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  sudo install -m 0755 -d /etc/apt/keyrings

  if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
    curl -fsSL "https://download.docker.com/linux/$(. /etc/os-release && printf '%s' "$ID")/gpg" \
      | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    sudo chmod a+r /etc/apt/keyrings/docker.gpg
  fi

  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

sudo usermod -aG docker "$DEPLOY_USER"
sudo systemctl enable --now docker nginx
sudo install -d -m 0755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$REMOTE_ROOT"

command -v curl >/dev/null
command -v nginx >/dev/null
command -v certbot >/dev/null
sudo docker compose version >/dev/null
sudo nginx -t

printf 'vm_bootstrap=ok\n'
REMOTE_BOOTSTRAP
