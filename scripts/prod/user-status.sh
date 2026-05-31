#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" || $# -ne 1 ]]; then
  printf 'usage: scripts/prod/user-status.sh <username>\n'
  exit 0
fi

username="$1"

vm_backend_eval \
  'username = System.fetch_env!("OOOLALA_ADMIN_USERNAME") |> Base.decode64!(); IO.inspect(Ooolala.Admin.user_status(username), limit: :infinity)' \
  "OOOLALA_ADMIN_USERNAME=$(b64 "$username")"
