#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

vm_backend_eval 'IO.inspect(Ooolala.Admin.metrics(), limit: :infinity)'

vm_ssh_bash "printf '\nvm_disk\n' && df -h / && printf '\nbackup_dir\n' && du -sh $(shell_quote "$OOOLALA_VM_REMOTE_ROOT/backups/$OOOLALA_VM_STACK") 2>/dev/null || true && printf '\ndeploy_dir\n' && du -sh $(shell_quote "$(vm_remote_dir)") 2>/dev/null || true && printf '\ndocker_system\n' && docker system df && printf '\ncontainers\n' && docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}'"
