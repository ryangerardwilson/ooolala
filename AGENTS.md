# AGENTS.md

## Purpose

This file tells Codex how to work inside `~/Apps/ooolala/`.

## Context Routing

Use `/home/ryan/AGENTS.md` and root subagents for role behavior. Use
`context/INDEX.md` and the files it names for Ooolala-specific facts.

Do not use or recreate project-owned `subagents/`; that pattern has been
retired in this workspace.

Start here:

- `context/INDEX.md`
- `context/product/PRODUCT.md` for product contract and interface priority
- `context/brand/BRAND.md` for Ooolala brand and public voice
- `context/architecture/REPO_AND_RUNTIME.md` for repo shape, auth, dev,
  verification, install, and deployment facts
- `context/operations/COST.md` for cost constraints

If a needed Ooolala fact is not present in `context/`, report the missing
context instead of borrowing facts from another project.
