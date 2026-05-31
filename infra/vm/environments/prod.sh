# Sourceable production deployment contract.
#
# Live targets and credentials stay outside the public repo. Operators should
# export the required values from their shell, for example from
# ~/.bashrc.d/14-ooolala-prod.sh.

if [[ -f "$HOME/.bashrc.d/10-secrets.sh" ]]; then
  set +u
  # shellcheck source=/dev/null
  source "$HOME/.bashrc.d/10-secrets.sh"
  set -u
fi

if [[ -f "$HOME/.bashrc.d/14-ooolala-prod.sh" ]]; then
  set +u
  # shellcheck source=/dev/null
  source "$HOME/.bashrc.d/14-ooolala-prod.sh"
  set -u
fi

require_env() {
  local name="$1"

  if [[ -z "${!name:-}" ]]; then
    printf 'missing required production environment variable: %s\n' "$name" >&2
    exit 1
  fi
}

: "${OOOLALA_VM_STACK:=prod}"
: "${OOOLALA_VM_ENVIRONMENT:=prod}"
: "${OOOLALA_VM_BACKEND_PORT:=4100}"
: "${OOOLALA_VM_REMOTE_ROOT:=/opt/ooolala}"
: "${OOOLALA_VM_MANAGE_DNS:=true}"
: "${OOOLALA_DNS_PROXIED:=false}"
: "${OOOLALA_DNS_TTL:=300}"
: "${OOOLALA_TLS_ENABLED:=true}"
: "${OOOLALA_OPEN_SIGNUP:=1}"
: "${OOOLALA_MAX_USERS:=75}"
: "${OOOLALA_SIGNUP_DAILY_LIMIT:=10}"
: "${OOOLALA_SIGNUP_HOURLY_LIMIT:=3}"
: "${OOOLALA_MESSAGE_RATE_LIMIT_COUNT:=30}"
: "${OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS:=60}"
: "${OOOLALA_MAX_MESSAGE_BYTES:=2048}"
: "${OOOLALA_MAX_ATTACHMENTS:=5}"
: "${OOOLALA_MAX_ATTACHMENT_BYTES:=5242880}"
: "${OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES:=15728640}"

require_env OOOLALA_VM_HOST
require_env OOOLALA_VM_USER
require_env OOOLALA_VM_SSH_KEY
require_env OOOLALA_VM_SERVER_NAME
require_env OOOLALA_VM_PUBLIC_URL

if [[ "$OOOLALA_VM_MANAGE_DNS" == "true" ]]; then
  require_env OOOLALA_CLOUDFLARE_ZONE_ID
  : "${OOOLALA_DNS_RECORD_NAME:=$OOOLALA_VM_SERVER_NAME}"
fi

if [[ "$OOOLALA_TLS_ENABLED" == "true" ]]; then
  require_env OOOLALA_TLS_EMAIL
fi

export OOOLALA_VM_STACK
export OOOLALA_VM_ENVIRONMENT
export OOOLALA_VM_HOST
export OOOLALA_VM_USER
export OOOLALA_VM_SSH_KEY
export OOOLALA_VM_SERVER_NAME
export OOOLALA_VM_PUBLIC_URL
export OOOLALA_VM_BACKEND_PORT
export OOOLALA_VM_REMOTE_ROOT
export OOOLALA_VM_MANAGE_DNS
export OOOLALA_CLOUDFLARE_ZONE_ID
export OOOLALA_DNS_RECORD_NAME
export OOOLALA_DNS_PROXIED
export OOOLALA_DNS_TTL
export OOOLALA_TLS_ENABLED
export OOOLALA_TLS_EMAIL
export OOOLALA_OPEN_SIGNUP
export OOOLALA_MAX_USERS
export OOOLALA_SIGNUP_DAILY_LIMIT
export OOOLALA_SIGNUP_HOURLY_LIMIT
export OOOLALA_MESSAGE_RATE_LIMIT_COUNT
export OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS
export OOOLALA_MAX_MESSAGE_BYTES
export OOOLALA_MAX_ATTACHMENTS
export OOOLALA_MAX_ATTACHMENT_BYTES
export OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES
