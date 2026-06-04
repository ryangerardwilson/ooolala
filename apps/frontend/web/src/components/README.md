# Ooolala Components

This directory is the web component API for Ooolala.

It is deliberately split into atomic implementation layers:

- `layout` - spatial primitives and screen shells.
- `colors` - named color schemes and CSS variable mapping.
- `fonts` - named font schemes and CSS variable mapping.
- `l1/primitives` - L1 basic UI atoms such as buttons, inputs, icons, and status text.
- `l2/patterns` - L2 reusable UX patterns such as form fields, command rows,
  empty states, dialog forms, and message bubbles.
- `l3/product` - L3 Ooolala product surfaces such as landing, docs, auth, and
  chat panels.
- `l3/terminal-signal` - L3 product-specific animated Ooolala wordmark.

The layers are exported as stable namespaces:

```ts
import {colors, fonts, layout, patterns, primitives, product} from './components';
```

The physical layer directories are exported too:

```ts
import {l1, l2, l3} from './components';
```

Backend behavior does not belong here. Components must not fetch, persist auth
state, poll, or know deployment URLs.
