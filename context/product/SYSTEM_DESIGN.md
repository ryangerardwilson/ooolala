# System Design

## Purpose

This file is Ooolala's CEO-owned source of truth for antifragile system design.
Future agents should use this file instead of relying on workspace-local context
outside the repository.

Antifragility is a property of a system under stress. It is not a synonym for
good, robust, resilient, polished, scalable, or well-designed.

## Core Model

A system has:

- a name
- a core algorithm
- an antifragility score from `0.0` to `1.0`

A core algorithm is the repeatable transformation:

```text
input -> logic -> output
```

A stress is an exposure, shock, volatility, constraint, error, load,
disruption, or uncertainty that perturbs the input, output, or both for a
specific core algorithm.

Antifragility is judged by how the system responds to stress:

- `0.0..0.333`: fragile
- `0.334..0.666`: robust
- `0.667..1.0`: antifragile

## Decision Rule

A non-predictive decision is a change made under uncertainty.

Classify the effect by comparing the system before and after the decision:

- antifragility decreases -> fragilizing
- antifragility stays the same -> neutral
- antifragility increases -> antifragilizing

Keep decisions that move antifragility upward. Reject decisions that improve a
visible metric while making future stress harder to absorb or learn from.

## Operating Rule

For important product, architecture, copy, cost, or design decisions:

1. Define the system being changed.
2. Define its core algorithm as input -> logic -> output.
3. Define the stress by how it perturbs the algorithm input and/or output.
4. Estimate whether the response is fragile, robust, or antifragile.
5. Keep only decisions that make future stress more useful.

## Ooolala Systems

### Product And Design

System: Ooolala product/design system.

Core algorithm:

```text
terminal-work chat friction -> product/design decision -> CLI/TUI/web behavior -> clearer future use
```

Primary stresses:

- auth confusion
- command ambiguity
- empty chats
- missed messages
- small screens
- web drift from CLI truth
- visual clutter
- unknown usernames
- failed sends

Antifragile response:

- commands become clearer
- defaults improve
- layouts become easier to operate
- empty states become actionable
- recovery paths become shorter
- component contracts become more precise

### Architecture

System: Ooolala technical architecture.

Core algorithm:

```text
code/data/protocol/deploy change -> backend/client/deploy decision -> inspectable running system
```

Primary stresses:

- deploy failure
- backend restart
- schema migration
- mixed client/backend versions
- Postgres or VM disruption
- abuse against signup or messaging
- local/prod drift

Antifragile response:

- boundaries become clearer
- version gates improve
- migrations become safer
- backups and restore paths get tested
- production remains recoverable from the repo

### Copy And Brand

System: Ooolala written interface.

Core algorithm:

```text
user context -> words shown in CLI/TUI/web/docs/errors -> user action with less uncertainty
```

Primary stresses:

- failed install
- auth confusion
- unclear signup path
- command misuse
- vague landing page
- repeated support questions

Antifragile response:

- help text becomes sharper
- README commands become more direct
- landing copy points to the actual first action
- errors name the next correction
- public copy avoids generic SaaS claims

### Cost

System: Ooolala operating cost model.

Core algorithm:

```text
usage/operating need + USD 20/month constraint -> hosting/dependency decision -> useful service under budget
```

Primary stresses:

- signup growth
- backup growth
- VM disk pressure
- CI minutes
- managed-service temptation
- speculative environments

Antifragile response:

- the system stays smaller
- metrics expose cost pressure
- backups are capped and outside the repo
- unnecessary services are deleted
- local dev plus one production VM remains understandable

## Forbidden Shortcut

Do not label a decision antifragile just because it sounds rigorous. It is
antifragile only when future stress makes the system easier to operate, learn
from, or improve.
