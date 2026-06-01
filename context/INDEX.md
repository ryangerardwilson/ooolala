# Ooolala Context Index

Project: Ooolala
Context version: 1

## Identity

Ooolala is CLI-first, TUI-second, web-third chat for terminal-heavy Codex and
Claude sessions.

The command name is always `ooolala`. Do not introduce a shorter alias.

## Load Order

Always start with:

- `/home/ryan/AGENTS.md`
- root CEO behavior from `/home/ryan/Subagents/ceo/`
- this file

Then load only the smallest context set needed for the task.

## Role Map

CEO/product framing:

- `context/product/PRODUCT.md`
- `context/product/ALGORITHM.md`
- `context/product/FOUNDER_MODE.md`
- `context/product/PRODUCT_PURITY.md`
- `context/product/SYSTEM_DESIGN.md`

CPO/product and design:

- `context/product/PRODUCT.md`
- `context/product/DESIGN.md`
- `context/product/MICROCOPY.md`
- `context/product/WHITE_SPACE.md`
- `context/brand/BRAND.md`

CMO/copy:

- `context/brand/BRAND.md`
- `context/copy/COPY.md`
- `context/copy/COPYWRITING_FRAMEWORKS.md`

CTO/architecture:

- `context/architecture/ARCHITECTURE.md`
- `context/architecture/REPO_AND_RUNTIME.md`

CFO/cost:

- `context/operations/COST.md`

## Conflict Policy

Ooolala project facts override root workspace defaults for Ooolala work.

Root subagents define role behavior. Ooolala `context/` files define Ooolala
facts, product truth, brand, architecture, copy, and cost constraints.

If a needed Ooolala fact is missing, report the missing context. Do not fall
back to Ryan's personal brand, Wiom, American Dream Enterprises, or any other
project's context.

## Update Policy

Update the narrowest relevant context file when a durable Ooolala fact changes.
Do not recreate project-owned `subagents/`; that pattern is retired.
