#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

require_cmd gzip
require_cmd scp

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
remote_backup_dir="$OOOLALA_VM_REMOTE_ROOT/backups/$OOOLALA_VM_STACK"
remote_file="$remote_backup_dir/manual-$stamp.dump.gz"
local_dir="${OOOLALA_BACKUP_DIR:-$HOME/.local/state/ooolala/backups/prod}"
keep_count="${OOOLALA_BACKUP_KEEP_COUNT:-20}"

vm_ssh_bash "mkdir -p $(shell_quote "$remote_backup_dir") && cd $(shell_quote "$(vm_remote_dir)") && docker compose --env-file .env -f compose.yaml exec -T postgres pg_dump -U ooolala -d ooolala -Fc | gzip -9 > $(shell_quote "$remote_file")"

mkdir -p "$local_dir"
vm_scp_from "$remote_file" "$local_dir/"

find "$local_dir" -name 'manual-*.dump.gz' -type f | sort | head -n "-$keep_count" | xargs -r rm -f
vm_ssh_bash "find $(shell_quote "$remote_backup_dir") -name 'manual-*.dump.gz' -type f | sort | head -n -$keep_count | xargs -r rm -f"

printf 'remote=%s\n' "$remote_file"
printf 'local=%s/%s\n' "$local_dir" "$(basename "$remote_file")"
printf 'remote_backup_size=%s\n' "$(vm_ssh_bash "du -sh $(shell_quote "$remote_backup_dir") | awk '{print \$1}'")"
printf 'local_backup_size=%s\n' "$(du -sh "$local_dir" | awk '{print $1}')"
