# Ooolala Components

This directory is the web component API for Ooolala.

It is deliberately split into four layers:

- `layout` - spatial primitives and screen shells.
- `colors` - named color schemes and CSS variable mapping.
- `fonts` - named font schemes and CSS variable mapping.
- `widgets` - reusable controls and product widgets.

The layers are exported as namespaces:

```ts
import {colors, fonts, layout, widgets} from './components';
```

Backend behavior does not belong here. Components must not fetch, persist auth
state, poll, or know deployment URLs.
