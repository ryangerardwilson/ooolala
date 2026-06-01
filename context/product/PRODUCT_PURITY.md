# CEO Product Purity

## Purpose

Use this file when deciding whether a product surface, flow, feature, copy
choice, dependency, or process should exist in Ooolala.

Product purity means the product is built around its core functional truth
rather than around convenience, brand polish, or generic SaaS expectations.
For Ooolala, that truth is terminal-first chat for Codex and Claude sessions.

## Core Rule

The core is greater than the brand.

Ooolala should prove itself through the actual CLI/TUI loop, not through a
browser-first onboarding funnel, decorative branding, or broad web-app
convenience. A surface that trains the wrong behavior is impure even if it is
technically easy, user-friendly in isolation, or common in other products.

## First Principles

Question every requirement against the elemental product facts:

- The user is already working in a terminal.
- The product name and command are `ooolala`.
- Terminal auth teaches the first product motion.
- The first valuable loop is auth -> DM `bob` or a known peer -> read/reply.
- The CLI owns account creation.
- The TUI is the second surface for sustained chat.
- The web app is a fallback/read/write client for existing accounts, not the
  account-creation teacher.

When a requirement conflicts with these facts, delete the requirement before
optimizing it.

## Product Purity Tenets

### Core Over Brand

Spend product effort on the command loop, delivery reliability, message
inspectability, snappy terminal use, and clear recovery. Do not add web-first
flows to make the product look more complete.

### Remove Non-Essentials

Delete surfaces that do not strictly serve the terminal-first product. The
default answer to duplicated onboarding paths is removal, not polish.

For production:

- Web account creation must not exist.
- Web login may exist for already-created users.
- Web password change may exist for already-authenticated users.
- The backend `/signup` endpoint may exist because CLI auth uses it to create
  free handles.
- Landing-page account creation must be an executable CLI auth command, not a
  browser form.

### The Machine That Builds The Machine

Product purity applies to the operating process, not only the visible UI.
Deployment scripts, environment variables, docs, tests, and agent context must
not preserve dead browser-signup machinery after the product decision deletes
browser signup.

If the product says terminal-only account creation, the repo should not keep a
web signup build flag, stale docs, or hidden browser tab that can reappear
during deploy.

### Microscopic Detail

Every label, form field, env var, test, and doc line should have a functional
reason. If a piece of UI or process exists only because it was previously
implemented, remove it.

## Account-Creation Purity Rule

Account creation is not generic identity plumbing. Terminal auth is the user's
first embodied lesson in how Ooolala works.

The canonical account-creation path is:

```sh
ooolala auth
```

The canonical activation loop is:

```sh
ooolala auth
ooolala send bob "hello"
ooolala tui
```

Do not add a browser signup form in production. It weakens product integrity at
minute zero by teaching the user that Ooolala is web-first or web-equivalent.

## Decision Checklist

Before allowing a product surface to exist, CEO must ask:

- Does this strengthen the CLI/TUI loop?
- Does this teach terminal-native behavior from minute zero?
- Is this a fallback for existing users, or a competing primary path?
- Can this be deleted without breaking the core product?
- Does this add dead process or env configuration?
- Would a user following the easiest path still learn Ooolala's intended
  behavior?

If the easiest path bypasses the terminal-first lesson, the surface fails
product purity.
