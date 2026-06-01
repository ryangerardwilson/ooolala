#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PULUMI_BIN="${PULUMI_BIN:-pulumi}"
PULUMI_ACTION="${OOOLALA_VM_PULUMI_ACTION:-up}"
TARGET_STACK=""

usage() {
  cat <<'EOF'
usage: scripts/infra/deploy-vm.sh [stack]

Deploy Ooolala to an existing SSH-accessible VM through Pulumi.

Prefer the environment wrappers:
  scripts/prod/deploy-servers-and-upgrade-cli.sh
EOF
}

while (($#)); do
  case "$1" in
    help)
      usage
      exit 0
      ;;
    -*)
      printf 'unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [[ -n "$TARGET_STACK" ]]; then
        printf 'unexpected argument: %s\n' "$1" >&2
        usage >&2
        exit 2
      fi
      TARGET_STACK="$1"
      ;;
  esac

  shift
done

case "$PULUMI_ACTION" in
  up|preview) ;;
  *)
    printf 'OOOLALA_VM_PULUMI_ACTION must be "up" or "preview"\n' >&2
    exit 2
    ;;
esac

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd npm
require_cmd openssl

# shellcheck source=../../infra/vm/environments/prod.sh
source "$ROOT/infra/vm/environments/prod.sh"

TARGET_STACK="${TARGET_STACK:-$OOOLALA_VM_STACK}"

if [[ ! "$TARGET_STACK" =~ ^[a-z0-9][a-z0-9_-]{0,63}$ ]]; then
  printf 'invalid VM stack: %s\n' "$TARGET_STACK" >&2
  exit 2
fi

OOOLALA_VM_STACK="$TARGET_STACK"
export OOOLALA_VM_STACK

if [[ "$PULUMI_BIN" == "pulumi" ]] && ! command -v pulumi >/dev/null 2>&1 && [[ -x "$HOME/.pulumi/bin/pulumi" ]]; then
  PULUMI_BIN="$HOME/.pulumi/bin/pulumi"
fi

if [[ -z "${OOOLALA_VM_SSH_KEY:-}" ]]; then
  printf 'OOOLALA_VM_SSH_KEY is required and should point to a private key under ~/.ssh\n' >&2
  exit 1
fi

if [[ ! -f "$OOOLALA_VM_SSH_KEY" ]]; then
  printf 'VM SSH key not found: %s\n' "$OOOLALA_VM_SSH_KEY" >&2
  exit 1
fi

if ! command -v "$PULUMI_BIN" >/dev/null 2>&1; then
  printf 'missing required command: %s\n' "$PULUMI_BIN" >&2
  printf 'Install Pulumi CLI, then rerun: scripts/infra/deploy-vm.sh %s\n' "$TARGET_STACK" >&2
  exit 1
fi

if [[ "${OOOLALA_VM_MANAGE_DNS:-true}" == "true" && -z "${CLOUDFLARE_API_TOKEN:-}" ]]; then
  printf 'CLOUDFLARE_API_TOKEN is required when OOOLALA_VM_MANAGE_DNS=true\n' >&2
  exit 1
fi

bundle_output="$(OOOLALA_VM_PUBLIC_URL="$OOOLALA_VM_PUBLIC_URL" "$ROOT/scripts/infra/build-vm-bundle.sh" "$TARGET_STACK")"
printf '%s\n' "$bundle_output"

BUNDLE="$(printf '%s\n' "$bundle_output" | awk -F= '$1=="bundle" {print $2}')"
COMMIT="$(printf '%s\n' "$bundle_output" | awk -F= '$1=="commit" {print $2}')"

if [[ -z "$BUNDLE" || -z "$COMMIT" ]]; then
  printf 'could not parse VM bundle output\n' >&2
  exit 1
fi

(
  cd "$ROOT/infra/vm"

  if ! "$PULUMI_BIN" stack select "$TARGET_STACK" >/dev/null 2>&1; then
    "$PULUMI_BIN" stack init "$TARGET_STACK"
  fi

  set_config() {
    local key="$1"
    local value="$2"

    "$PULUMI_BIN" config set "$key" "$value"
  }

  set_secret_if_missing() {
    local key="$1"
    local value="$2"

    if ! "$PULUMI_BIN" config get "$key" >/dev/null 2>&1; then
      "$PULUMI_BIN" config set --secret "$key" "$value"
    fi
  }

  set_config host "$OOOLALA_VM_HOST"
  set_config user "$OOOLALA_VM_USER"
  set_config sshPrivateKeyPath "$OOOLALA_VM_SSH_KEY"
  set_config serverName "$OOOLALA_VM_SERVER_NAME"
  set_config defaultServer "${OOOLALA_VM_DEFAULT_SERVER:-false}"
  set_config publicUrl "$OOOLALA_VM_PUBLIC_URL"
  set_config backendPort "$OOOLALA_VM_BACKEND_PORT"
  set_config remoteRoot "$OOOLALA_VM_REMOTE_ROOT"
  set_config runtimeEnvironment "$OOOLALA_VM_ENVIRONMENT"
  set_config manageDns "$OOOLALA_VM_MANAGE_DNS"
  if [[ "$OOOLALA_VM_MANAGE_DNS" == "true" ]]; then
    set_config cloudflareZoneId "$OOOLALA_CLOUDFLARE_ZONE_ID"
    set_config dnsRecordName "$OOOLALA_DNS_RECORD_NAME"
  fi
  set_config dnsProxied "$OOOLALA_DNS_PROXIED"
  set_config dnsTtl "$OOOLALA_DNS_TTL"
  set_config tlsEnabled "$OOOLALA_TLS_ENABLED"
  if [[ "$OOOLALA_TLS_ENABLED" == "true" ]]; then
    set_config tlsEmail "$OOOLALA_TLS_EMAIL"
  fi
  set_config openSignup "$OOOLALA_OPEN_SIGNUP"
  set_config maxUsers "$OOOLALA_MAX_USERS"
  set_config signupDailyLimit "$OOOLALA_SIGNUP_DAILY_LIMIT"
  set_config signupHourlyLimit "$OOOLALA_SIGNUP_HOURLY_LIMIT"
  set_config messageRateLimitCount "$OOOLALA_MESSAGE_RATE_LIMIT_COUNT"
  set_config messageRateLimitWindowSeconds "$OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS"
  set_config maxMessageBytes "$OOOLALA_MAX_MESSAGE_BYTES"
  set_config maxAttachments "$OOOLALA_MAX_ATTACHMENTS"
  set_config maxAttachmentBytes "$OOOLALA_MAX_ATTACHMENT_BYTES"
  set_config maxAttachmentsTotalBytes "$OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES"
  if [[ -n "${OOOLALA_WELCOME_PASSWORD:-}" ]]; then
    "$PULUMI_BIN" config set --secret welcomePassword "$OOOLALA_WELCOME_PASSWORD"
  fi
  set_secret_if_missing postgresPassword "$(openssl rand -hex 24)"
  set_secret_if_missing secretKeyBase "$(openssl rand -base64 48)"

  "$PULUMI_BIN" config set bundlePath "$BUNDLE"
  "$PULUMI_BIN" config set commit "$COMMIT"

  if [[ "$PULUMI_ACTION" == "preview" ]]; then
    "$PULUMI_BIN" preview
  else
    "$PULUMI_BIN" up --yes
  fi
)
