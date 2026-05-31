# AGENTS.md

## Product Contract

Ooolala is a CLI-first, TUI-second, web-third chat app.

- The command name is always `ooolala`; do not introduce a shorter alias.
- The backend is Elixir.
- The terminal client is Node.js/TypeScript.
- The TUI is an Ink mode inside the terminal client.
- The web app is React, Vite, and Tailwind.

This stack is a deliberate project-specific exception to the workspace's usual
Python/curses default for CLI/TUI apps. The terminal clients share one Node
runtime while the backend keeps Elixir's supervision and concurrency model.

## Repository Shape

- `apps/backend/` - Elixir backend.
- `apps/backend/main.ex` - backend process entrypoint.
- `apps/backend/lib/` - backend support modules only.
- `apps/backend/lib/tasks/` - custom Mix database tasks.
- `apps/frontend/terminal/` - public CLI and Ink TUI mode.
- `apps/frontend/web/` - React/Vite/Tailwind web app.
- `apps/frontend/web/src/components/` - web component API: layout, colors, fonts, and widgets.
- `infra/vm/` - current Pulumi VM deployment.
- `scripts/dev/` - local dev server and CLI wrappers.
- `scripts/prod/` - production deploy wrapper.
- `scripts/infra/` - shared deployment helpers.

Keep the backend flat under `apps/backend/`. Do not split it into nested
backend sub-apps.

## Interface Priority

Build and judge product behavior in this order:

1. CLI behavior
2. TUI behavior
3. Web behavior

Web screens should support the same identity, room, and message concepts the
terminal already exposes. Avoid adding web-only product primitives unless the
CLI contract changes first.

## Antifragile Meaning

Use `subagents/ceo/SYSTEM_DESIGN.md` as the repo-owned source of truth for
antifragility. CEO owns system-design framing.
Antifragility is a property of a system under stress, not a vague synonym for
good, robust, resilient, polished, or scalable.

For any important decision, define:

- system: the thing being changed.
- core algorithm: the repeatable input -> logic -> output transformation.
- stress: an error, constraint, disruption, uncertainty, cost pressure, user
  confusion, deploy failure, or usage shock that perturbs the input and/or
  output of that core algorithm.
- response: whether the system gets more fragile, merely survives, or improves
  because of that stress.

A decision is antifragilizing only if it increases the system's ability to
benefit from future stress. A decision is fragile if it improves a visible
metric while making future stress harder to absorb or learn from.

For Ooolala:

- Antifragile UX means real user friction improves the CLI/TUI/web flow,
  command grammar, defaults, and recoverability.
- Antifragile architecture means crashes, deploys, migrations, restarts, and
  protocol changes create clearer boundaries, better version gates, and easier
  recovery.
- Antifragile copy means repeated confusion improves help text, onboarding,
  README instructions, errors, and landing-page language.
- Antifragile cost discipline means the USD 20/month constraint improves
  simplicity and operating leverage instead of hiding spend in extra services.

## Codex Subagent Protocol

When the user asks Codex for multi-agent, parallel, or role-based work, run one
lead Codex session as the integrator and spawn subagents for bounded,
non-overlapping work.

The lead session owns:

- task decomposition
- final architecture decisions
- merge/integration
- verification
- commits and pushes to `main`

Subagents must receive explicit scope, ownership, and stop conditions. They are
not alone in the codebase; they must not revert or overwrite other agents'
work. Name subagent roles after these executive jobs, not generic
implementation titles.

CEO sits above all other subagents. The CEO has final authority on what should
be done, what should be deleted, and which first-principles frame decides the
problem. CEO is not a peer-reconciliation layer and must not average CPO, CTO,
CMO, and CFO positions. The CEO is deliberately aggressive about reducing the
problem to mission, hard constraints, direct evidence, system mechanics, and
deletion before considering consensus, convention, or compromise. The CEO must
also apply founder-style product sense from `subagents/ceo/FOUNDER_MODE.md`,
so first principles include product philosophy, minute-zero user behavior, and
the difference between terminal-native and merely terminal-compatible. The CEO
must also apply `subagents/ceo/PRODUCT_PURITY.md`; product purity deletes
surfaces that dilute the terminal-first core, including browser signup. Role
brief: `subagents/ceo/ALGORITHM.md`.

The other executive roles report upward through the CEO:

- CPO: exacting about antifragile product and design direction. Owns product
  flow, surface priority, visual direction, component design rules,
  CLI/TUI/web interaction shape, friction removal, and whether stress from real
  usage improves the product. CPO must apply `BRAND_GUIDELINES.md` as product
  context, not merely copy context. Role brief: `subagents/cpo/DESIGN.md`.
- CTO: exacting about antifragile architecture. Owns system boundaries,
  persistence, deployment shape, versioning, failure modes, and whether stress
  from change makes the system easier to operate. Role brief:
  `subagents/cto/ARCHITECTURE.md`.
- CMO: exacting about antifragile copy. Owns public-facing wording, onboarding,
  help text, README language, install instructions, and whether copy gets
  clearer under repeated user confusion. Role brief: `subagents/cmo/COPY.md`.
- CFO: exacting about keeping this project under USD 20/month. Owns hosting
  choices, infrastructure cost review, dependency cost risk, and whether the
  operating model remains cheap during prototyping. Role brief:
  `subagents/cfo/COST.md`.

These roles may propose implementation work, but the lead must still assign a
specific write scope before any subagent edits files. If CPO, CTO, CMO, and CFO
conflict, spawn or consult CEO and let CEO decide from first principles, not
from majority vote or reconciliation.

Conflict boundaries:

- CPO decides behavior, product intent, layout, interaction model, and
  component-design rules.
- CMO decides wording, public positioning, onboarding language, and help/error
  copy.
- CTO may block technically unsafe or operationally fragile design.
- CFO may block cost-increasing design that violates the USD 20/month
  constraint.
- CEO has final authority when these boundaries conflict, and the CEO's
  authority is exercised through first-principles reasoning rather than
  compromise for its own sake.

CEO/CPO loop:

1. CPO drafts product and design requirements.
2. CEO questions every requirement and deletes weak parts.
3. CPO turns surviving requirements into product/design contracts.
4. CTO, CMO, and CFO execute or review within that contract.
5. CEO re-enters if the contract becomes vague, expensive, overbuilt, or
   detached from CLI-first usage.

Load the relevant role brief before spawning that executive subagent.

Spawn subagents only for substantial work that benefits from parallelism or
independent review. Do not spawn agents for one-file edits, small copy changes,
or urgent blocking work the lead must do immediately.

Use this prompt shape:

```text
Follow AGENTS.md and <role brief path>. You are the <CEO|CPO|CTO|CMO|CFO> for
Ooolala.

Goal:
<concrete outcome>

Ownership:
Only edit <paths>. Do not touch unrelated files.

Coordination:
Other agents may be editing other parts of the repo. Do not revert their work.
Report changed files, tests run, and remaining risks.
```

Keep write scopes disjoint. If two agents need the same file, the lead edits
that file directly or serializes the work. The lead must inspect subagent
changes before committing.

## Web Component API

The web component API lives under `apps/frontend/web/src/components/` and has
four layers:

- `layout` - spatial primitives and screen shells.
- `colors` - semantic color schemes and CSS variable mapping.
- `fonts` - body/mono font schemes and CSS variable mapping.
- `widgets` - buttons, inputs, product panels, message bubbles, and chat UI atoms.

Component contracts should name function in platform-neutral terms so web, TUI,
iOS, Android, and desktop implementations can preserve the same behavior.

Keep auth, API calls, polling, local storage, and deployment behavior in web app
code outside the component API.

## Backend Rules

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

- Local dev and production allow open account creation through the shared backend auth
  policy.
- CLI auth is the only product account-creation path. Production web account
  creation must not exist; the backend `/signup` endpoint remains an
  implementation endpoint for the terminal client.
- Web sign-in may authenticate existing users and web password-change may support
  authenticated users, but web must not claim usernames or create accounts.
- New account and password-change passwords must be at least 12 characters.
- `bob` is the public welcome account for first DMs.
- Production must not store Bob's password in the repo; use
  `OOOLALA_WELCOME_PASSWORD` from deployment environment if Bob needs login.
- Legacy seeded users exist only for local dev and narrow tests. Production
  migrations must not create active weak seeded accounts.
- `ooolala auth [username]` creates the account when the handle is free, or
  saves existing credentials after a hidden password prompt when it exists.
- `ooolala signout` clears saved local credentials without changing the backend
  account.
- `ooolala password` changes only the password; usernames are permanent.
- `ooolala send <username> <message> attach <path> [path ...]` is the canonical
  file-send shape. Directories are archived by the terminal client before
  upload.
- `ooolala download <message-id> <attachment-id> [dir]` is the canonical
  terminal retrieval shape.
- Attachment bytes are stored in Postgres through `message_attachments`; do not
  add a separate object store while the single-VM USD 20/month constraint is the
  operating model.
- TUI clients consume saved CLI auth and must not grow a separate login screen.
- The production web app may expose sign-in and password-change forms only. It
  must point account creation back to `ooolala auth` instead of exposing a
  browser signup form.
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
root Node workspace dependencies with `npm ci` and writes the active local URLs
to `.dev/dev.env`. `scripts/dev/run-cli.sh` performs the same dependency
bootstrap before launching the terminal client.

Default verification:

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

Production open-signup controls are set through `infra/vm/environments/prod.sh`
and Pulumi VM config:

- `OOOLALA_OPEN_SIGNUP=1`
- `OOOLALA_MAX_USERS=75`
- `OOOLALA_SIGNUP_DAILY_LIMIT=10`
- `OOOLALA_SIGNUP_HOURLY_LIMIT=3`
- `OOOLALA_MESSAGE_RATE_LIMIT_COUNT=30`
- `OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS=60`
- `OOOLALA_MAX_MESSAGE_BYTES=2048`

Production deploys must take a Postgres backup before migrations. Operator
scripts under `scripts/prod/` are the repo-owned path for metrics,
disable/enable, user status, backup, and restore.

VM SSH keys must not live in the repo. Point `OOOLALA_VM_SSH_KEY` at a private
key under `~/.ssh`.

Use local dev as the stabilization lane. Do not switch the hosted deploy
platform without an explicit architecture change.

`main` is the promotion branch for the current simple workflow.
