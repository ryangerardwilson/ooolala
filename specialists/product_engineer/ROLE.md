# Ooolala Product Engineer

## Project Contract

Ooolala is CLI-first, TUI-second, web-third chat for terminal-heavy Codex and
Claude sessions.

- Use `Ooolala` in prose.
- Use `ooolala` for the command name and terminal/UI marks.
- Do not introduce a shorter alias.
- Prefer `username` over `handle` unless referring to UI that already says
  handle.
- The backend is Elixir.
- The terminal client is Node.js/TypeScript.
- The TUI is an Ink mode inside the terminal client.
- The web app is React, Vite, and Tailwind.

This stack is a project-specific exception to the workspace's usual
Python/curses default for CLI/TUI apps. The terminal clients share one Node
runtime while the backend keeps Elixir's supervision and concurrency model.

Judge product behavior in this order:

1. CLI behavior
2. TUI behavior
3. Web behavior

The CLI defines the durable command grammar. The TUI should be a fast room
switcher and composer. The web app should provide broader context,
auth/account flows, and non-terminal access without creating a second product.
No web-only product primitive is allowed unless the CLI contract changes first.

## Product Flows

Public first-run flow:

```sh
curl -fsSL https://ooolala.ryangerardwilson.com/install.sh | bash
ooolala auth
ooolala send bob "hello"
ooolala tui
```

Browser sign-in is valid, but the public first path should stay CLI-first
unless the product contract changes. Bob is the public welcome account for
first DMs. `ooolala skills` prints the agent-facing usage instructions.

Core flow:

- install with the hosted installer
- auth with a username and password; the same command creates or signs in
- inspect identity with `ooolala who`
- send the first DM by knowing a username, usually `bob`
- read with `ooolala read <username>` and
  `ooolala watch <username> incoming`
- open the TUI through saved CLI auth
- open the web app through saved CLI auth or web sign-in

Support flows:

- change password without changing username
- open local config
- inspect local/backend version vectors
- upgrade through `ooolala upgrade`
- recover from disabled, invalid, or unknown users with short next-step errors

Copyable command UI must copy only paste-ready commands. Do not copy
placeholders such as `<username>`. If a command needs user input, use the
prompting form, such as `ooolala auth`.

## Marketing Objective

Ooolala is also a public proof object for Ryan's ability to design and operate
complex systems. The project should market the complexity, judgment, and
integration quality Ryan can bring to software systems, while remaining honest
that Ooolala is still in a nascent stage.

The GitHub repository is intentionally public for this reason. Public copy may
use the repo's visibility as evidence that the architecture, product thinking,
and implementation can be inspected directly.

Do not overstate maturity, adoption, scale, or polish. The stronger marketing
claim is that the project exposes real system-design depth in public, not that
the product is already fully mature.

## Brand And Product Voice

Core line:

```text
CLI-first chat for Codex and Claude sessions.
```

Plainer line:

```text
WhatsApp is wrong for terminal-heavy AI coding sessions, so I built Ooolala.
```

The voice is plain, compact, practical, terminal-native, builder-authored,
slightly opinionated, concrete, and anti-bloat. Sound like a tool that
respects the user's shell, not a collaboration platform trying to feel
exciting.

Copy rules:

- Prefer commands over explanation when a command solves the problem.
- Say what the user can do now.
- Keep errors short and actionable.
- Use concrete nouns: CLI, TUI, web, username, DM, message, room, auth.
- Onboarding copy must point to signup and first DM.
- Public copy must not teach seeded users.
- Do not describe speculative infrastructure or future surfaces as current
  product.
- Do not market staging, internal protocol, or deployment machinery.
- Avoid generic SaaS claims unless the text names the concrete user effect.

Forbidden public positioning and product claims:

- seamless
- robust
- scalable
- innovative
- empower
- productivity platform
- next-generation
- frictionless
- AI-powered chat platform
- AI-native collaboration hub
- community-first
- enterprise-ready
- future of work
- for teams

These words can appear only when quoting a source or when the sentence names a
specific concrete behavior instead of making a vague claim.

Visual direction:

- Terminal-functional, not terminal cosplay.
- Use restrained borders, readable spacing, stable layout, and semantic color
  roles.
- Real commands and real chat state beat decorative terminal mockups.
- Web can look polished, but it should still feel like an extension of the CLI.
- Avoid mascots, glossy AI visuals, generic gradient SaaS heroes, fake
  dashboards, and brand theater.

## Repo Shape

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

## Runtime And State

- `mix` is Elixir's project runner.
- `apps/backend/mix.exs` is the backend project manifest.
- `apps/backend/main.ex` is the backend OTP application entrypoint.
- The Docker release is named `backend` and starts with `/app/bin/backend`.
- Keep persistence in the backend.
- Keep terminal-specific formatting in the Node clients.
- Keep message storage append-oriented and replayable.
- Keep local dev close to production by using Docker Postgres.
- Do not keep speculative infrastructure scaffolding in the repo.

`VERSION` is the single checked-in product version source. The Elixir backend
and terminal client both read `VERSION`.

`install.sh` builds the terminal workspace and installs a thin launcher in
`~/.local/bin`. Production installs `ooolala` with state under `~/.ooolala`.
Hosted install wrappers must set their API URL, web URL, install URL, app
name, and environment before execing the compiled terminal client.

`ooolala help`, `ooolala version`, and `ooolala upgrade` are canonical. Do not
add short aliases for these commands.

Ooolala is not GitHub-release-managed. Do not add a separate release script.
Promotion runs through local verification and the production deploy script.

Project-specific no-arg exception: if local auth is missing, `ooolala` starts
the auth prompt instead of printing help. New local dev users should use
`ooolala auth <username>` explicitly.

## Auth And Messaging

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
- `ooolala auth [username]` creates the account when the username is free, or
  saves existing credentials after a hidden password prompt when it exists.
- `ooolala signout` clears saved local credentials without changing the
  backend account.
- `ooolala password` changes only the password; usernames are permanent.
- TUI clients consume saved CLI auth and must not grow a separate login
  screen.
- `ooolala skills` prints root `SKILLS.md` for Codex/Claude usage guidance.
- Do not store secrets in checked-in plaintext files.

File-send shape:

```sh
ooolala send <username> <message> attach <path> [path ...]
```

Terminal retrieval shape:

```sh
ooolala download <message-id> <attachment-id> [dir]
```

Attachment bytes are stored in Postgres through `message_attachments`. Do not
add a separate object store while the single-VM USD 20/month constraint is the
operating model.

## Web Surface

The production web app may expose sign-in and password-change forms only. It
must point account creation back to `ooolala auth`.

Web screens should support the same identity, room, and message concepts the
terminal already exposes. Avoid adding web-only product primitives unless the
CLI contract changes first.

Top-level web pages should fit their primary experience inside `100svh` at
common desktop and mobile viewports. The page itself should not require an
initial down-scroll to complete its main job.

Default viewport expectations:

- landing page: brand, core line, activation commands, and primary web CTA fit
  in the first viewport
- auth page: sign-in form and status area fit in the first viewport
- chat page: header, transcript, and composer fit inside a fixed-height shell;
  only the transcript scrolls

Web component API:

- `layout` owns spatial composition, screen shells, scroll regions, and modal
  placement.
- `colors` owns semantic color roles, named schemes, and CSS variable values.
- `fonts` owns body and mono font stacks plus font CSS variables.
- `l1/primitives` owns L1 basic UI atoms such as buttons, inputs, textareas,
  icons, and status text.
- `l2/patterns` owns L2 reusable UX patterns such as form fields, command rows,
  empty states, dialog forms, and message bubbles.
- `l3/product` owns L3 Ooolala product surfaces such as landing, docs, auth, and
  chat panels.

Components must not own auth, polling, API calls, storage, deployment URLs, or
backend behavior. L3 product components may represent Ooolala concepts, but
must receive state and actions from the app orchestrator instead of fetching or
persisting directly.

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

The dev CLI stores credentials under `.dev/ooolala-home`, so it does not touch
the installed production state.

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

## Deployment And Cost

Target total project infrastructure cost: under USD 20/month during
prototyping.

- Prefer one production VM plus local dev while usage is early.
- Do not add hosted staging, managed queues, managed caches, paid monitoring,
  or paid preview environments without a concrete stressor.
- Keep local dev free except for the user's own machine.
- Keep production dependencies inspectable and replaceable.
- Treat every new hosted service as a recurring liability.
- A cheaper setup is not better if it makes recovery opaque or data fragile.

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
