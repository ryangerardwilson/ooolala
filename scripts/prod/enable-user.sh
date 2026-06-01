#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=./vm-common.sh
source "$ROOT/scripts/prod/vm-common.sh"

if [[ "${1:-}" == "help" || $# -ne 1 ]]; then
  printf 'usage: scripts/prod/enable-user.sh <username>\n'
  [[ "${1:-}" == "help" ]] && exit 0 || exit 2
fi

username="$1"

vm_backend_eval \
  'username = System.fetch_env!("OOOLALA_ADMIN_USERNAME") |> Base.decode64!(); IO.inspect(Ooolala.Admin.enable_user(username), limit: :infinity)' \
  "OOOLALA_ADMIN_USERNAME=$(b64 "$username")"
