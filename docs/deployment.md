# Deployment

Ooolala now has two environments:

- local dev, started from the repo
- production, deployed to the VM

Only local dev and production are supported.

## Local Dev

Start the local stack:

```sh
scripts/dev/run-servers.sh
```

Use the dev CLI from another terminal:

```sh
scripts/dev/run-cli.sh auth <username>
scripts/dev/run-cli.sh send bob "hello"
scripts/dev/run-cli.sh tui
```

Local dev uses Docker Postgres, the Elixir backend, the React web app, and
isolated CLI state under `.dev/`.

## Production

Production deploys through the VM Pulumi path:

```sh
scripts/prod/deploy-servers-and-upgrade-cli.sh
```

The wrapper sources `infra/vm/environments/prod.sh`, refuses dirty worktrees,
runs local verification, asks for confirmation, applies the VM stack, takes a
pre-migration Postgres backup, collects smoke-test evidence, then upgrades the
installed `ooolala` CLI.

Production URL:

```text
https://ooolala.ryangerardwilson.com
```

Public docs are served by the existing React/Vite web bundle at:

```text
https://ooolala.ryangerardwilson.com/docs
```

## Evidence

Deployment evidence is written under `.evidence/`:

```sh
scripts/infra/collect-deployment-evidence.sh dev
```

The VM deploy path also records the deployed commit in the generated bundle.

## Operations

```sh
scripts/prod/metrics.sh
scripts/prod/user-status.sh <username>
scripts/prod/disable-user.sh <username> "reason"
scripts/prod/enable-user.sh <username>
scripts/prod/backup-postgres.sh
scripts/prod/restore-postgres.sh "$HOME/.local/state/ooolala/backups/prod/<backup.dump.gz>"
```

Production account creation is open through `ooolala auth`, but capped by VM
config: 75 total users, 10 account creations per day, and 3 per hour by
default.
Attachment upload is capped by VM config too: 5 files, 5 MiB each, and 15 MiB
total per message by default. Nginx allows a 24 MiB request body so the backend
limits decide the user-facing rejection.
Bob is reserved as the welcome account. Set `OOOLALA_WELCOME_PASSWORD` before
deployment if Bob needs an operator-known login password.
