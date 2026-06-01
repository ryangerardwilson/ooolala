#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

usage() {
  cat <<'EOF'
usage: scripts/prod/restore-postgres.sh help
usage: scripts/prod/restore-postgres.sh <backup.dump.gz>

Restore the production Postgres volume from a gzip-compressed pg_dump custom
archive. The script creates a fresh production backup before restoring.
EOF
}

if [[ "${1:-}" == "help" || $# -ne 1 ]]; then
  usage
  if [[ "${1:-}" == "help" ]]; then
    exit 0
  fi
  exit 2
fi

backup_file="$1"
if [[ ! -f "$backup_file" ]]; then
  printf 'backup file not found: %s\n' "$backup_file" >&2
  exit 1
fi

phrase="restore prod"
if [[ "${OOOLALA_RESTORE_CONFIRM:-}" != "$phrase" ]]; then
  if [[ ! -t 0 ]]; then
    printf 'refusing non-interactive restore. Set OOOLALA_RESTORE_CONFIRM="%s" to confirm.\n' "$phrase" >&2
    exit 1
  fi

  printf 'Type "%s" to restore production from %s: ' "$phrase" "$backup_file" >&2
  IFS= read -r answer
  if [[ "$answer" != "$phrase" ]]; then
    printf 'aborted\n' >&2
    exit 1
  fi
fi

printf '==> taking safety backup before restore\n'
"$ROOT/scripts/prod/backup-postgres.sh"

remote_in="/tmp/ooolala-restore-$(date -u +%Y%m%dT%H%M%SZ).dump.gz"
vm_scp_to "$backup_file" "$remote_in"

vm_ssh_bash "cd $(shell_quote "$(vm_remote_dir)") && docker compose --env-file .env -f compose.yaml up -d postgres && docker compose --env-file .env -f compose.yaml stop backend || true && gunzip -c $(shell_quote "$remote_in") | docker compose --env-file .env -f compose.yaml exec -T postgres pg_restore -U ooolala -d ooolala --clean --if-exists --no-owner && docker compose --env-file .env -f compose.yaml run --rm backend /app/bin/backend eval 'Ooolala.Migrations.run_url(System.fetch_env!(\"DATABASE_URL\"))' && docker compose --env-file .env -f compose.yaml up -d backend && for i in \$(seq 1 60); do if curl -fsS http://127.0.0.1:$OOOLALA_VM_BACKEND_PORT/health >/dev/null 2>&1; then break; fi; sleep 1; done && curl -fsS http://127.0.0.1:$OOOLALA_VM_BACKEND_PORT/health && curl -fsS 'http://127.0.0.1:$OOOLALA_VM_BACKEND_PORT/version?format=text' && rm -f $(shell_quote "$remote_in")"

printf 'restored %s\n' "$backup_file"
