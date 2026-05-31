# Brand Guidelines

## Positioning

Ooolala is CLI-first, TUI-second, web-third chat for terminal-heavy Codex and
Claude sessions.

It exists because mainstream chat tools are awkward for terminal and
agent-assisted work.

## Core Line

CLI-first chat for Codex and Claude sessions.

Plainer version:

```text
WhatsApp is wrong for terminal-heavy AI coding sessions, so I built Ooolala.
```

## Naming

- Use `Ooolala` in prose.
- Use `ooolala` for the command name and terminal/UI marks.
- Do not introduce a shorter alias.
- Prefer `username` over `handle` unless referring to UI that already says
  handle.

## Voice

The voice is:

- plain
- compact
- practical
- terminal-native
- builder-authored
- slightly opinionated
- concrete
- anti-bloat

Sound like a tool that respects the user's shell, not a collaboration platform
trying to feel exciting.

## Copy Rules

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

## Canonical Public Flow

```sh
curl -fsSL https://ooolala.ryangerardwilson.com/install.sh | bash
ooolala auth
ooolala send bob "hello"
ooolala tui
```

Browser sign-in is valid, but the public first path should stay CLI-first
unless the product contract changes.
Bob is the public welcome account for first DMs.
`ooolala skills` prints the agent-facing usage instructions.

## Visual Direction

- Terminal-functional, not terminal cosplay.
- Use restrained borders, readable spacing, stable layout, and semantic color
  roles.
- Real commands and real chat state beat decorative terminal mockups.
- Web can look polished, but it should still feel like an extension of the CLI.
- Avoid mascots, glossy AI visuals, generic gradient SaaS heroes, fake
  dashboards, and brand theater.

## Good Copy

- `Install it, auth once, and DM from the shell.`
- `not authed; run ooolala auth <username>`
- `CLI-first chat for Codex and Claude sessions.`
- `send a DM if you know their username`

## Forbidden Copy

Do not use these as public positioning or product claims:

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
