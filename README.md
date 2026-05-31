# Ooolala

CLI-first, TUI-second, web-third chat for terminal-heavy Codex and Claude
sessions.

## Repo Shape

- `apps/backend/` - Elixir backend, auth, persistence, and chat domain.
- `apps/backend/main.ex` - backend process entrypoint.
- `apps/backend/lib/` - backend support modules.
- `apps/frontend/terminal/` - Node.js terminal client: CLI plus Ink TUI mode.
- `apps/frontend/web/` - React/Vite/Tailwind web app.
- `apps/frontend/web/src/components/` - web component API: layout, colors, fonts, and widgets.
- `infra/vm/` - current Pulumi VM deployment.
- `scripts/dev/` - local dev wrappers.
- `scripts/prod/` - production deploy wrapper.
- `subagents/ceo/SYSTEM_DESIGN.md` - CEO-owned antifragile system design context.
- `BRAND_GUIDELINES.md` - public voice, naming, and copy rules.

## Install

Production:

```sh
curl -fsSL https://ooolala.ryangerardwilson.com/install.sh | bash
ooolala auth <username>
ooolala send bob "hello from my terminal"
```

Browser docs live at `https://ooolala.ryangerardwilson.com/docs`.

The installer builds the terminal workspace and writes a thin launcher to
`~/.local/bin`. Production state lives under `~/.ooolala`.

## CLI

```sh
ooolala help
ooolala version
ooolala upgrade
ooolala auth <username>
ooolala signout
ooolala password
ooolala who
ooolala send bob "hello"
ooolala send bob "logs attached" attach ./run.log ./screenshots
echo "hello from stdin" | ooolala send bob -
ooolala download <message-id> <attachment-id> .
ooolala read bob
ooolala read bob last 10
ooolala read bob unread incoming
ooolala watch bob incoming
ooolala open bob
ooolala close bob
ooolala tui
ooolala skills
```

`ooolala signout` clears saved local credentials without changing the backend
account. `ooolala tui` launches the Ink TUI using saved CLI auth.
Bob is the public welcome account for first DMs.
`ooolala skills` prints the agent-facing instructions from `SKILLS.md`.

Attachments are part of the backend message log. Files are uploaded through
`ooolala send <username> <message> attach <path> [path ...]`; directories are
archived before transfer. Recipients can copy the printed
`<message-id>/<attachment-id>` pair and run `ooolala download <message-id>
<attachment-id> [dir]`. Production caps attachments at 5 files, 5 MiB each, and
15 MiB total per message by default.

## Auth

Current auth is username/password over HTTPS-backed Basic Auth.

- Local dev and production allow account creation with `ooolala auth [username]`.
- `ooolala auth [username]` creates the account when the handle is free, or
  signs in when it already exists.
- The production web app does not expose account creation.
- New account and password-change passwords must be at least 12 characters.
- Usernames are permanent.
- `ooolala password` changes only the password.
- A DM can be opened only by knowing the other user's exact username.
- Bob is reserved as the welcome account. Production can set
  `OOOLALA_WELCOME_PASSWORD` outside the repo before migrations if the account
  needs to be logged into.

## Local Development

Start the local stack:

```sh
scripts/dev/run-servers.sh
```

That starts Docker Postgres, runs backend migrations, starts the Elixir backend,
starts the React web app, and writes the active URLs to `.dev/dev.env`.
It also runs `npm ci` when the root Node workspace dependencies are missing.

Use the dev CLI from another terminal:

```sh
scripts/dev/run-cli.sh auth user3
scripts/dev/run-cli.sh send bob "hello from dev"
scripts/dev/run-cli.sh tui
```

The dev CLI stores credentials under `.dev/ooolala-home`, so it does not touch
the installed production state. It also bootstraps missing Node workspace
dependencies before launching the terminal client.

Lower-level commands:

```sh
docker compose up -d postgres
cd apps/backend && OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix ooolala.db.migrate
cd apps/backend && OOOLALA_BACKEND_HTTP=1 OOOLALA_STORE=postgres DATABASE_URL="postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev" mix run --no-halt
npm --workspace apps/frontend/terminal run tui
npm --workspace apps/frontend/web run dev
```

`mix` is Elixir's project runner. The backend entrypoint is
`apps/backend/main.ex`; the HTTP edge is `apps/backend/lib/http_server.ex`.

## Verification

Run these before promotion:

```sh
npm ci
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

Promotion order is local/dev, then production. Local dev is the stabilization
lane; production is only for changes already verified locally.

Production:

```sh
scripts/prod/deploy-servers-and-upgrade-cli.sh
ooolala version
ooolala send bob "hello from prod"
```

Production deploys to `https://ooolala.ryangerardwilson.com`.
The public docs route is `https://ooolala.ryangerardwilson.com/docs`.

The production wrapper refuses dirty worktrees, runs local verification, applies
the VM Pulumi stack, takes a pre-migration Postgres backup, collects smoke-test
evidence, then upgrades the installed CLI. Live VM, DNS, token, and SSH-key
values are read from local environment variables, not from checked-in files.

Production operator commands:

```sh
scripts/prod/metrics.sh
scripts/prod/user-status.sh <username>
scripts/prod/disable-user.sh <username> "reason"
scripts/prod/enable-user.sh <username>
scripts/prod/backup-postgres.sh
scripts/prod/restore-postgres.sh "$HOME/.local/state/ooolala/backups/prod/<backup.dump.gz>"
```

## Versioning

`VERSION` is the single checked-in product version source.

`ooolala version` prints the local compatibility vector and, when reachable,
the backend vector from `GET /version?format=text`. `ooolala upgrade` runs the
installer upgrade path.

Compatibility fields:

- `cli_contract`
- `chat_protocol`
- `db_schema`
- `auth_policy`
- `ui_flow`
- `commit`
- `environment`
