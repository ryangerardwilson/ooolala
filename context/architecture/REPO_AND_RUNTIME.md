# Ooolala Repo And Runtime Context

## Repository Shape

- `apps/backend/` - Elixir backend.
- `apps/backend/main.ex` - backend process entrypoint.
- `apps/backend/lib/` - backend support modules only.
- `apps/backend/lib/tasks/` - custom Mix database tasks.
- `apps/frontend/terminal/` - public CLI and Ink TUI mode.
- `apps/frontend/web/` - React/Vite/Tailwind web app.
- `apps/frontend/web/src/components/` - web component API.
- `infra/vm/` - current Pulumi VM deployment.
- `scripts/dev/` - local dev server and CLI wrappers.
- `scripts/prod/` - production deploy wrapper.
- `scripts/infra/` - shared deployment helpers.

Keep the backend flat under `apps/backend/`. Do not split it into nested
backend sub-apps.

## Runtime Rules

- `mix` is Elixir's project runner.
- `apps/backend/mix.exs` is the backend project manifest.
- `apps/backend/main.ex` is the backend OTP application entrypoint.
- The Docker release is named `backend` and starts with `/app/bin/backend`.
- Keep persistence in the backend.
- Keep terminal-specific formatting in the Node clients.
- Keep message storage append-oriented and replayable.

## Versioning And Install

- `VERSION` is the single checked-in product version source.
- The Elixir backend and terminal client both read `VERSION`.
- `install.sh` builds the terminal workspace and installs a thin launcher in
  `~/.local/bin`.
- Production installs `ooolala` with state under `~/.ooolala`.
- Hosted install wrappers must set their API URL, web URL, install URL, app
  name, and environment before execing the compiled terminal client.
- `ooolala help`, `ooolala version`, and `ooolala upgrade` are canonical.
  Do not add short aliases for these commands.
- Ooolala is not GitHub-release-managed. Do not add a separate release script.
  Promotion runs through local verification and the production deploy script.

Project-specific no-arg exception: if local auth is missing, `ooolala` starts
the auth prompt instead of printing help. New local dev users should use
`ooolala auth <username>` explicitly.

## Auth And State

- Local dev and production allow open account creation through the shared
  backend auth policy.
- CLI auth is the only product account-creation path.
- Production web account creation must not exist; the backend `/signup`
  endpoint remains an implementation endpoint for the terminal client.
- Web sign-in may authenticate existing users and web password-change may
  support authenticated users, but web must not claim usernames or create
  accounts.
- New account and password-change passwords must be at least 12 characters.
- `bob` is the public welcome account for first DMs.
- Production must not store Bob's password in the repo; use
  `OOOLALA_WELCOME_PASSWORD` from deployment environment if Bob needs login.
- Legacy seeded users exist only for local dev and narrow tests.
- `ooolala auth [username]` creates the account when the handle is free, or
  saves existing credentials after a hidden password prompt when it exists.
- `ooolala signout` clears saved local credentials without changing the
  backend account.
- `ooolala password` changes only the password; usernames are permanent.
- `ooolala send <username> <message> attach <path> [path ...]` is the
  canonical file-send shape.
- `ooolala download <message-id> <attachment-id> [dir]` is the canonical
  terminal retrieval shape.
- Attachment bytes are stored in Postgres through `message_attachments`; do
  not add a separate object store while the single-VM USD 20/month constraint
  is the operating model.
- TUI clients consume saved CLI auth and must not grow a separate login screen.
- The production web app may expose sign-in and password-change forms only. It
  must point account creation back to `ooolala auth`.
- `ooolala skills` prints root `SKILLS.md` for Codex/Claude usage guidance.
- Do not store secrets in checked-in plaintext files.

## Development

Use the repo scripts as the default local path:

```sh
scripts/dev/run-servers.sh
scripts/dev/run-cli.sh auth <username>
scripts/dev/run-cli.sh send bob "hello"
```

`scripts/dev/run-servers.sh` starts Docker Postgres, runs backend migrations,
starts the Elixir backend, and starts the React web app. It bootstraps missing
root Node workspace dependencies with `npm ci` and writes active local URLs to
`.dev/dev.env`.

## Verification

```sh
npm test --workspaces --if-present
npm run build --workspaces --if-present
cd apps/backend && mix test
docker compose -f compose.yaml up -d --wait postgres
cd apps/backend && OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix ooolala.db.migrate
cd apps/backend && OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix test
docker build -f docker/backend.Dockerfile -t ooolala-backend-pathcheck .
OOOLALA_VM_PUBLIC_URL=https://example.com scripts/infra/build-vm-bundle.sh prod
```

## Deployment

Promotion order is mandatory:

1. Local/dev verification.
2. Production deploy and smoke test.

Current deployment is VM-first:

```sh
scripts/prod/deploy-servers-and-upgrade-cli.sh
ooolala version
```

Production uses `ooolala.ryangerardwilson.com`. Live VM, DNS, token, and
SSH-key values are read from local environment variables, not checked-in files.

The VM path is the current source of truth for hosted deploys:

- `infra/vm/`
- `infra/vm/environments/`
- `scripts/prod/`
- `scripts/infra/`

Production deploys must take a Postgres backup before migrations. Operator
scripts under `scripts/prod/` are the repo-owned path for metrics,
disable/enable, user status, backup, and restore.

VM SSH keys must not live in the repo. Point `OOOLALA_VM_SSH_KEY` at a private
key under `~/.ssh`.

Use local dev as the stabilization lane. Do not switch the hosted deploy
platform without an explicit architecture change.
