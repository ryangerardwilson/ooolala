# Ooolala Product Context

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

## Interface Priority

Build and judge product behavior in this order:

1. CLI behavior
2. TUI behavior
3. Web behavior

Web screens should support the same identity, room, and message concepts the
terminal already exposes. Avoid adding web-only product primitives unless the
CLI contract changes first.

## Antifragile Meaning

Use `context/product/SYSTEM_DESIGN.md` as the repo-owned source of truth for
antifragility. CEO owns system-design framing.

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
