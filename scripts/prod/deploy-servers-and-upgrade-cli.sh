#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# shellcheck source=../../infra/vm/environments/prod.sh
source "$ROOT/infra/vm/environments/prod.sh"

usage() {
  cat <<'EOF'
usage: scripts/prod/deploy-servers-and-upgrade-cli.sh

Run local verification, ask for confirmation, deploy production through the VM
Pulumi path, collect smoke-test evidence, then upgrade the installed production
CLI through the freshly deployed installer.
EOF
}

require_clean_tree() {
  if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
    cat >&2 <<'EOF'
Refusing to deploy production from a dirty worktree.

Commit and push the exact code you want deployed, then rerun the production
deploy wrapper.
EOF
    exit 1
  fi
}

run_verification() {
  if [[ "${OOOLALA_SKIP_PROD_VERIFY:-}" == "1" ]]; then
    printf '==> skipping production verification by OOOLALA_SKIP_PROD_VERIFY=1\n'
    return
  fi

  printf '==> verifying production candidate\n'
  (cd "$ROOT" && npm test --workspaces --if-present)
  (cd "$ROOT" && npm run build --workspaces --if-present)
  (cd "$ROOT/apps/backend" && mix test)
  (cd "$ROOT" && docker compose -f compose.yaml up -d --wait postgres)
  (
    cd "$ROOT/apps/backend"
    OOOLALA_STORE=postgres \
      DATABASE_URL="${OOOLALA_VERIFY_DATABASE_URL:-postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev}" \
      mix ooolala.db.migrate
    OOOLALA_STORE=postgres \
      DATABASE_URL="${OOOLALA_VERIFY_DATABASE_URL:-postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev}" \
      mix test
  )
  (cd "$ROOT" && docker build -f docker/backend.Dockerfile -t ooolala-backend-pathcheck .)
  "$ROOT/scripts/infra/build-vm-bundle.sh" "$OOOLALA_VM_STACK"
}

confirm_deploy() {
  local phrase="deploy prod"
  local answer=""

  if [[ "${OOOLALA_DEPLOY_CONFIRM:-}" == "$phrase" ]]; then
    return
  fi

  if [[ ! -t 0 ]]; then
    printf 'refusing to deploy without an interactive confirmation. Set OOOLALA_DEPLOY_CONFIRM="%s" to confirm non-interactively.\n' "$phrase" >&2
    exit 1
  fi

  printf '\nType "%s" to apply production and upgrade the CLI: ' "$phrase" >&2
  if ! IFS= read -r answer || [[ "$answer" != "$phrase" ]]; then
    printf 'aborted\n' >&2
    exit 1
  fi
}

for arg in "$@"; do
  case "$arg" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'unexpected argument: %s\n' "$arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! command -v curl >/dev/null 2>&1; then
  cat >&2 <<'EOF'
Production deploys must also upgrade the installed production CLI, but `curl`
is not available.
EOF
  exit 1
fi

require_clean_tree
run_verification

confirm_deploy

printf '==> production deploy\n'
OOOLALA_VM_PULUMI_ACTION=up "$ROOT/scripts/infra/deploy-vm.sh" "$OOOLALA_VM_STACK"

printf '==> collecting production evidence\n'
OOOLALA_BACKEND_URL="${OOOLALA_VM_PUBLIC_URL%/}/api" \
  OOOLALA_WEB_URL="$OOOLALA_VM_PUBLIC_URL" \
  "$ROOT/scripts/infra/collect-deployment-evidence.sh" prod

printf '==> upgrading production CLI\n'
curl -fsSL "${OOOLALA_VM_PUBLIC_URL%/}/install.sh" | bash
ooolala version
