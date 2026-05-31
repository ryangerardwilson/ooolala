# VM Pulumi Strategy

Ooolala uses Pulumi only for the current VM production path.

The active target is:

- existing SSH-accessible VM
- Docker Postgres
- Elixir backend container
- React/Vite static web files served by nginx
- nginx `/api` proxy
- Cloudflare DNS record
- hosted `install.sh` for the production CLI

Local dev is the stabilization lane. Production is the only hosted environment.

## Source Of Truth

- `infra/vm/` owns the Pulumi VM program.
- `infra/vm/environments/prod.sh` owns the production environment contract.
- VM keys and live target values stay outside the repo and are read from the
  operator's shell.
- `scripts/infra/bootstrap-vm.sh` prepares or checks a VM.
- `scripts/prod/deploy-servers-and-upgrade-cli.sh` deploys production and then
  upgrades the installed CLI.

## Promotion

```sh
npm test --workspaces --if-present
npm run build --workspaces --if-present
cd apps/backend && mix test
docker compose -f compose.yaml up -d --wait postgres
cd apps/backend && OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix ooolala.db.migrate
cd apps/backend && OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix test
OOOLALA_VM_PUBLIC_URL=https://example.com scripts/infra/build-vm-bundle.sh prod
scripts/prod/deploy-servers-and-upgrade-cli.sh
```

The production wrapper refuses dirty worktrees, runs local verification, asks
for confirmation, runs `pulumi up`, collects smoke-test evidence, then runs
the freshly deployed hosted installer.

## Later

If Ooolala outgrows the single-VM path, design the next target from scratch at
that time. Do not keep speculative cloud scaffolding in this repo.
