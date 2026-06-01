# CPO White Space

## Purpose

Use this file when judging spacing, density, grouping, visual hierarchy, and
viewport fit for Ooolala surfaces.

White space is not empty space. It is a product tool for focus, grouping,
sequence, and conversion. In Ooolala, white space must make the CLI-first
activation loop easier to perceive and execute.

## Core Rule

Plan white space before polishing components.

If the spacing is wrong, the page will feel awkward even if every individual
component is well made. Before changing font size, borders, particles, copy, or
buttons, define the empty space that should make the composition readable.

## Ooolala White-Space Frame

Ooolala's landing page has one job:

```text
understand terminal-native chat -> copy/install -> signup -> DM bob -> open TUI
```

White space should support that sequence by:

- isolating the activation loop as the primary action.
- grouping related text and commands by proximity.
- separating header chrome from the hero without creating dead air.
- letting the Three.js signal act as atmosphere, not a competing object.
- avoiding decorative separators when spacing can do the separation.
- keeping the whole first experience inside `100svh`.

## Principles

### Space Is A CTA Tool

Users notice an action because competing elements leave it alone. The command
stack is Ooolala's primary action, so it needs enough space around it to feel
copyable and intentional.

Do not crowd the command stack with explanatory copy, badges, status strips, or
decorative panels. Do not push it so far down that it feels secondary.

### Isolate The Product

For Ooolala, the product is not a screenshot or a hero illustration. The
product is the command loop. Put the command loop in the visual center of
gravity and remove distractions around it.

### Group By Proximity

Elements that belong together should be close:

- eyebrow + H1 + support line are one meaning group.
- install/signup/dm/tui are one action group.
- header brand + web fallback are chrome, not part of the hero group.

The gap between meaning group and action group should be larger than gaps
inside either group, but not so large that the action feels disconnected.

### Replace Lines With Space

Separator lines can make a layout feel boxed and noisy. Prefer white space for
section separation before adding borders. Keep borders only where they identify
interactive objects, such as command rows, forms, and chat shells.

### Fit Is Not Composition

Compressing a page until it fits `100svh` is not the same as composing it.
Viewport fit is a hard constraint, but the CPO must still check whether the
remaining space guides the eye naturally.

If fitting requires every gap to become equally small, delete a low-value
element before squeezing the layout further.

### Dark Space Still Counts

Ooolala uses a dark theme. Negative space is still white space even when it is
black, green, or textured. A dark empty region should either create focus or
create atmosphere. If it creates neither, it is dead space.

### Backgrounds Must Not Own Space

The Three.js wordmark and terminal grid may enrich the empty field, but they do
not justify bad spacing. The background should sit behind the hierarchy already
created by layout.

### Responsive Space Must Be Replanned

Desktop, short desktop, mobile, and small mobile need different white-space
balances. Do not merely scale a desktop composition down.

Use these checks:

- desktop: the hero group should not float too low in the page.
- short desktop: the action group must remain fully visible without feeling
  crushed.
- mobile: the support line may wrap, so command rows need tighter but still
  readable grouping.
- small mobile: delete or compress decorative space before shrinking the
  commands below comfortable tap targets.

## Landing Page Spacing Contract

The landing page must satisfy all of these:

- header chrome is visually separate from the hero.
- the hero group starts soon enough that the top half of the viewport has
  substance.
- the command stack begins close enough to the support line to read as the next
  action.
- individual command rows have enough breathing room to be scanned and tapped.
- the bottom of the command stack has margin, not a clipped or accidental edge.
- there is no initial document scroll at common desktop and mobile viewport
  sizes.

## Review Checklist

Before approving a landing-page or auth-page change, answer:

- What is the primary action, and has space isolated it?
- Which elements are grouped by proximity?
- Which gaps separate groups?
- Is any empty area creating focus, or is it dead space?
- Could spacing replace a border or box?
- Does the page still fit inside `100svh` after realistic command wrapping?
- Does the layout work in dark mode without feeling empty or unfinished?
- Did the background visual improve atmosphere without taking ownership of the
  composition?

## Output Requirement

When reporting on white space, CPO must include:

- the current visual hierarchy.
- the intended eye path.
- the groups and separating gaps.
- the dead-space risks.
- exact spacing or deletion changes to make.
