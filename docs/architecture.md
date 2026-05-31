# Ooolala Architecture

## Product Order

Ooolala is intentionally ordered:

1. CLI
2. TUI
3. Web

The CLI defines the durable command grammar. The TUI and web app should expose
the same room, message, identity, and sync concepts with richer rendering, not
separate product models.

## System Frame

System: Ooolala chat system.

Core algorithm:

- Input: user identity, room, message body, optional attachments, local device
  state, backend sync state
- Logic: authenticate the user, validate the requested peer username,
  append to a deterministic DM room log, persist, and render the latest room
  projection
- Output: inspectable room history across CLI, TUI, and web

Primary stresses:

- Offline or unreliable network
- Multiple clients sending at once
- Backend deploys and restarts
- Terminal-first users who need copyable state and obvious commands
- Later web users who expect the same room state without learning a second app

Antifragile direction:

- Keep the backend DM path simple enough to inspect from the CLI.
- Keep message state append-oriented and easy to replay.
- Put backend side effects behind small Elixir modules.
- Make TUI and web projections disposable clients of the same room model.

## Monorepo Shape

```text
apps/backend/
  main.ex                backend process entrypoint
  lib/http_server.ex     HTTP edge
  lib/ooolala.ex         backend API boundary
  lib/chat.ex            message and room logic
  lib/auth*.ex           auth policy and credential stores
  lib/room_store*.ex     memory/Postgres room persistence
  lib/tasks              explicit database maintenance commands
apps/frontend/terminal      Node.js CLI plus Ink TUI mode
apps/frontend/web           React/Vite/Tailwind interface
apps/frontend/web/src/components
                            web layout, colors, fonts, and widgets API
infra                       Pulumi TypeScript
```

## Backend Strategy

Start with the Elixir core and OTP store. Add edges in this order:

1. Health and smoke-test HTTP endpoints.
2. Authenticated HTTP message append/list APIs.
3. WebSocket or Phoenix-channel style fanout.
4. Durable Postgres append log.
5. Presence and delivery receipts only after the message log is stable.

The backend should own persistence and sync. It should not own terminal-specific
formatting.

## Development Data Strategy

Local development should exercise the same persistence shape as cloud
environments:

- `scripts/dev/run-servers.sh` starts the full local dev stack against Docker
  Postgres.
- `mix ooolala.db.migrate` is the explicit schema gate before the backend
  serves chat state.
- Tests should cover Node workspaces, Elixir memory mode, and Elixir Postgres
  mode before promotion.
- `OOOLALA_STORE=memory` is available only for throwaway runs and narrow tests.
- The first Postgres adapter uses the standard `psql` client instead of a Hex
  package so an incomplete local Erlang install cannot block the DB path.
- The hand-rolled HTTP edge and `psql` adapter are acceptable only inside the
  current capped single-VM prototype. They must remain covered by direct edge
  and adapter regression tests. Before materially raising production caps or
  adding more public API surface, move the HTTP edge to Plug/Cowboy and the DB
  adapter to Postgrex or justify a fresh first-principles exception.

The current message model is append-oriented. Restarts, redeploys, and client
polling should all replay from the same durable `messages` table instead of
depending on process memory.
Attachment bytes are stored in Postgres beside the message log through
`message_attachments`, so normal database backups include both metadata and
files. The cap defaults are intentionally small during the single-VM prototype:
5 attachments, 5 MiB each, and 15 MiB total per message.

## Versioning Strategy

Versioning is a runtime compatibility system, not just a release label.

Core algorithm:

- Input: code, data, protocol, auth, UI-flow, and environment changes.
- Logic: classify which contract moved, publish the smallest stable vector, and
  let clients compare compatibility before assuming behavior.
- Output: CLI, TUI, web, backend, and database state can be inspected under
  partial deploys or mixed client versions.

The product version stays human-facing and comes from `VERSION`. Runtime
compatibility uses monotonic contract numbers:

- `cli_contract`: command grammar, output shape, and local state rules.
- `chat_protocol`: backend/client message exchange shape.
- `db_schema`: durable Postgres schema migrations.
- `auth_policy`: login/session/security assumptions.
- `ui_flow`: material TUI/web/component-flow changes.

The backend exposes JSON at `GET /version` and text at
`GET /version?format=text`. The CLI exposes `ooolala version`, which always
prints local contract state and degrades to an explicit backend-unavailable
line when the backend cannot be reached.

Every failure that reaches a user should add a permanent version gate or
regression test. A bug fix alone is robust; a bug fix plus a new gate is
antifragile.

## CLI Strategy

The CLI should stay compact and backend-backed:

- Local dev and production users can create accounts with
  `ooolala auth [username]`.
- First `ooolala` run bootstraps login when credentials are missing.
- `ooolala auth [username]` creates the account when the handle is free, or
  saves existing credentials after a hidden password prompt when it exists.
- `ooolala signout` clears saved local credentials without touching the backend
  account.
- `ooolala password` changes only the password; username handles are permanent.
- `ooolala send <username> <message>` uses the backend direct-message path.
- `ooolala send <username> <message> attach <path> [path ...]` uploads small
  files; directory paths are archived before transfer.
- `ooolala download <message-id> <attachment-id> [dir]` saves an attachment from
  the backend through authenticated download.
- `ooolala send <username> -` reads message text from stdin.
- `ooolala read <username>` reads that backend direct-message path.
- `ooolala read <username> unread incoming` prints unseen incoming messages.
- `ooolala watch <username> incoming` keeps polling for incoming messages.
- `ooolala open <username>` creates or restores a known chat.
- `ooolala close <username>` hides a chat from the chat list without deleting the transcript.
- `ooolala tui` launches the Node/Ink TUI from the CLI surface with saved CLI
  credentials; the TUI does not own a separate login screen.
- `/` serves the React product page with CLI-first positioning and CLI install
  commands. `/docs` serves a static command-index page from the same Vite
  bundle; it must not require backend auth, polling, or a separate docs
  service. `/web` serves the browser app surface; unauthenticated users see
  sign-in there, and account creation stays in `ooolala auth`.
- Hosted terminal clients install production as `ooolala` with state under
  `~/.ooolala`; local dev wrappers isolate test state under `.dev/`.
- `ooolala config` opens the real local config file.
- `ooolala help`, `ooolala version`, and `ooolala upgrade` are canonical.
- The installed launcher should keep repeated command startup snappy by
  execing the compiled Node terminal client directly.
- Terminal/web client behavior belongs in Node/TypeScript. Backend concurrency,
  persistence, and realtime fanout belong in Elixir.

Keep command output compact and scriptable. Prefer short flags and stable verbs.

Promotion should flow through local/dev, then prod. Local dev is the
stabilization lane; production deploys only after local CLI, TUI, web, and
backend checks pass.

## Hosted Cutover Rule

The backend path is the product path. Production deploys should ship only after
local evidence includes backend health, CLI help/version, TUI snapshot, web
build output, Docker path check, and commit SHA.

## TUI Strategy

The Node TUI should be a fast room switcher and composer, not a terminal copy of
the web app. It should optimize for:

- keyboard room switching
- visible recent messages
- low chrome
- no modal maze

## Web Strategy

The React web app is the broadest interface and should remain third priority.
It should serve a direct product landing page for unauthenticated users, then
become a room workspace after login or CLI auth handoff.

Use the web app for:

- wider room context
- account and device settings
- admin or observability surfaces
- sharing flows that are awkward in terminal
