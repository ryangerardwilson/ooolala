#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

if [[ "${1:-}" == "help" || $# -lt 1 ]]; then
  printf 'usage: scripts/prod/disable-user.sh <username> [reason]\n'
  [[ "${1:-}" == "help" ]] && exit 0 || exit 2
fi

username="$1"
reason="${2:-operator disabled}"

vm_backend_eval \
  'username = System.fetch_env!("OOOLALA_ADMIN_USERNAME") |> Base.decode64!(); reason = System.fetch_env!("OOOLALA_ADMIN_REASON") |> Base.decode64!(); IO.inspect(Ooolala.Admin.disable_user(username, reason), limit: :infinity)' \
  "OOOLALA_ADMIN_USERNAME=$(b64 "$username")" \
  "OOOLALA_ADMIN_REASON=$(b64 "$reason")"
