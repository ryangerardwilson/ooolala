#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=../../infra/vm/environments/prod.sh
source "$ROOT/infra/vm/environments/prod.sh"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

ensure_vm_key() {
  require_cmd ssh

  if [[ -z "${OOOLALA_VM_SSH_KEY:-}" ]]; then
    printf 'OOOLALA_VM_SSH_KEY is required and should point to a private key under ~/.ssh\n' >&2
    exit 1
  fi

  if [[ ! -f "$OOOLALA_VM_SSH_KEY" ]]; then
    printf 'VM SSH key not found: %s\n' "$OOOLALA_VM_SSH_KEY" >&2
    exit 1
  fi
}

shell_quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}

b64() {
  printf '%s' "$1" | base64 | tr -d '\n'
}

vm_remote_dir() {
  printf '%s/%s\n' "$OOOLALA_VM_REMOTE_ROOT" "$OOOLALA_VM_STACK"
}

vm_ssh() {
  ensure_vm_key
  ssh \
    -i "$OOOLALA_VM_SSH_KEY" \
    -p "${OOOLALA_VM_SSH_PORT:-22}" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "$OOOLALA_VM_USER@$OOOLALA_VM_HOST" \
    "$@"
}

vm_ssh_bash() {
  local script="$1"
  vm_ssh "bash -lc $(printf '%q' "set -euo pipefail; $script")"
}

vm_scp_from() {
  ensure_vm_key
  scp \
    -P "${OOOLALA_VM_SSH_PORT:-22}" \
    -i "$OOOLALA_VM_SSH_KEY" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "$OOOLALA_VM_USER@$OOOLALA_VM_HOST:$1" \
    "$2"
}

vm_scp_to() {
  ensure_vm_key
  scp \
    -P "${OOOLALA_VM_SSH_PORT:-22}" \
    -i "$OOOLALA_VM_SSH_KEY" \
    -o IdentitiesOnly=yes \
    -o StrictHostKeyChecking=accept-new \
    "$1" \
    "$OOOLALA_VM_USER@$OOOLALA_VM_HOST:$2"
}

vm_backend_eval() {
  local code="$1"
  shift || true

  local env_flags=""
  local assignment
  for assignment in "$@"; do
    env_flags+=" -e $(shell_quote "$assignment")"
  done

  vm_ssh_bash "cd $(shell_quote "$(vm_remote_dir)") && docker compose --env-file .env -f compose.yaml exec -T${env_flags} backend /app/bin/backend eval $(shell_quote "$code")"
}
