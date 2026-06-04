# Ooolala Components

This directory is the web component API for Ooolala.

It is deliberately split into atomic implementation layers:

- `layout` - spatial primitives and screen shells.
- `colors` - named color schemes and CSS variable mapping.
- `fonts` - named font schemes and CSS variable mapping.
- `primitives` - L1 basic UI atoms such as buttons, inputs, icons, and status text.
- `patterns` - L2 reusable UX patterns such as form fields, command rows,
  empty states, dialog forms, and message bubbles.
- `product` - L3 Ooolala product surfaces such as landing, docs, auth, and
  chat panels.

The layers are exported as namespaces:

```ts
import {colors, fonts, layout, patterns, primitives, product} from './components';
```

Backend behavior does not belong here. Components must not fetch, persist auth
state, poll, or know deployment URLs.
