# CMO Copywriting Frameworks

## Purpose

Use this file when writing or reviewing landing-page copy, onboarding copy,
docs, launch notes, social copy, emails, ads, value propositions, CTAs,
headlines, testimonials, and longer persuasive pages.

Copywriting frameworks are scaffolds. They prevent blank-page guessing and
force the copy to answer the right questions in the right order. They are not a
license to sound generic, manipulative, or salesy.

For Ooolala, taste means: clear, terminal-native, specific, useful, and
credible. The copy should make the CLI/TUI workflow feel inevitable, not make
the product sound like a loud SaaS funnel.

## First Principles

Good copy starts with research, not formulas.

Before choosing a framework, identify:

- audience: Codex/Claude users, terminal-heavy builders, collaborators, or
  browser-only fallback users
- stage: unaware, problem-aware, solution-aware, returning user, activated user
- desired action: install, run `ooolala auth`, sign in, DM `bob`, open TUI, read
  `SKILLS.md`, upgrade, recover from error
- objection: terminal friction, WhatsApp annoyance, trust, time, privacy,
  cost, unclear next step
- proof: working command, screenshot, demo, user behavior, version/deploy
  evidence, real transcript, metric, testimonial

If the framework does not fit the user's stage or action, use a smaller one.

## Ooolala Copy Hierarchy

Ooolala is CLI-first, TUI-second, web-third.

The preferred conversion ladder is:

1. install Ooolala
2. claim a username
3. DM `bob` or a known peer
4. open the TUI
5. give an agent `SKILLS.md`

Do not let web copy invert this hierarchy. Browser signup must not exist in the
product surface. The CLI path is the product's proof.

## Core Page Frameworks

### AIDA

Use for compact pages and short landing sections.

- Attention: name the problem or unusual angle.
- Interest: show why this matters now.
- Desire: make the outcome concrete.
- Action: ask for one next step.

Ooolala use:

- attention: "Your coding session is in the terminal."
- interest: mainstream chat breaks agent-assisted terminal workflows.
- desire: chat with humans and agents without leaving the shell.
- action: copy the install command.

Guardrail: do not skip desire. A page with only problem plus button feels thin.

### AIDCA / IDCA

Use when skepticism matters.

- Add conviction before action through proof: demo, testimonial, metric,
  deploy evidence, screenshot, or specific workflow.
- Use IDCA when the user arrived from a source that already earned attention.

Ooolala use:

- show the command flow and a real terminal/TUI state before asking for deeper
  commitment.

### PAS

Use for concise problem-led copy.

- Problem: name the friction.
- Agitation: make the cost vivid but not melodramatic.
- Solution: show Ooolala's path.

Ooolala use:

- problem: WhatsApp is awkward for Codex/Claude sessions.
- agitation: context, commands, and replies get split across tools.
- solution: CLI-first chat with TUI and web fallbacks.

Guardrail: do not over-agitate. The product is useful, not life-or-death.

### 4 Ps

Preferred variant: problem, promise, proof, proposal.

- Problem: the concrete friction.
- Promise: what changes.
- Proof: why the claim is believable.
- Proposal: the next action.

Ooolala use:

- problem: agent-assisted work happens in terminal, but chat lives elsewhere.
- promise: keep the first DM/read loop in the toolchain.
- proof: install, signup, DM, TUI, and skills commands are visible.
- proposal: copy install.

### PAPA

Use when a feature needs benefits and proof.

- Problem.
- Advantages of solving it.
- Proof.
- Action.

Ooolala use:

- feature sections for `ooolala send`, `ooolala tui`, `ooolala skills`, and
  browser fallback.

### QUEST

Use when qualifying the right user matters.

- Qualify the user.
- Show you understand their current workflow.
- Educate them on a better path.
- Stimulate desire for that better path.
- Transition them into action.

Ooolala use:

- pages for Codex/Claude users where the audience is intentionally narrow.

Guardrail: qualification should feel clarifying, not exclusionary.

## Long-Form Frameworks

Use long-form structures only when the user needs proof or education before
acting. Most Ooolala surfaces should be shorter.

### Problem / Solution / Proof / Action

Default long-form structure for Ooolala.

- Lead with the actual workflow pain.
- Introduce the terminal-first model.
- Show concrete commands and screenshots.
- Ask for the smallest real action.

### Seven-Step Sales Page

Use only for a launch page, investor-style narrative, or a larger public
announcement.

1. Promise the most important benefit.
2. Expand the benefit immediately.
3. State what the user gets.
4. Support with proof.
5. Show the cost of doing nothing.
6. Restate the strongest benefit.
7. Ask for immediate action.

Guardrail: do not manufacture urgency. Use this only when the product is mature
enough to sustain the argument.

### Star / Story / Solution

Use when a real user story exists.

- Star: the person, agent, or workflow.
- Story: what happened.
- Solution: how Ooolala changed the outcome.

Ooolala use:

- case studies about Codex/Claude sessions coordinating with a human.

Guardrail: no fake stories.

## Headlines And Value Props

Headlines must name the product, category, or sharp offer. Avoid cleverness
that delays comprehension.

Good Ooolala headline patterns:

- `{Product} is a {category} for {specific user/workflow}`
- `{Product} helps {audience} do {outcome} without {objection}`
- `The {category} for {specific workflow}`
- `{Problem}. {Product} {specific better path}.`

Examples:

- `Ooolala is CLI-first chat for Codex and Claude sessions.`
- `Chat from the terminal without dragging WhatsApp into your workflow.`
- `A terminal-owned chat loop with TUI and web sign-in fallback.`

Avoid:

- vague superlatives
- fake category creation
- "AI-powered" unless the sentence names the practical behavior
- headlines that could belong to any team-chat product

## Value Proposition Formulas

Use these when the product needs to explain itself quickly.

For / Who / That:

- For `terminal-heavy builders` who `use Codex or Claude in active sessions`,
  Ooolala is `CLI-first chat` that `keeps human and agent replies inside the
  workflow`.

We help X do Y by Z:

- We help `Codex/Claude users` `coordinate with humans` by `using DM commands,
  a TUI, and web sign-in for existing accounts`.

What / How / Why:

- Ooolala is `chat for terminal sessions`.
- It works through `CLI commands, an Ink TUI, and a React web fallback`.
- So `agents and humans can communicate without context-switching into
  WhatsApp`.

Customer / Problem / Solution:

- Users doing agent-assisted work already live in the terminal, but their chat
  does not. Ooolala gives them a username-based DM system that works from CLI,
  TUI, and browser without creating separate identities.

## CTA And Button Frameworks

Buttons are not decoration. They should describe the action precisely.

I Want Button:

- Complete "I want to ___" or "I want you to ___".
- Button becomes the shortest action phrase.

Ooolala examples:

- `copy install`
- `sign in`
- `send`
- `save`

Get:

- Use `get` only when the user actually receives something.
- Good: `get install command` if the action reveals/copies the command.
- Weak: `get started` when the real action is signup.

RAD:

- Required info: does the user know enough to click?
- Acquisition: is the control easy to find and use?
- Desire: does the promised outcome match the user's goal?

Guardrail: if the user lacks required context, improve the surrounding copy
before changing the button.

Command Verb + Offer:

- Good for external landing pages and ads.
- Example: `Copy the install command`.

Guardrail: do not add fake urgency.

## Bullets And Feature Lists

Use bullets when the user is comparing or scanning.

Default Ooolala bullet formula:

- feature
- practical effect
- user benefit

Example:

- `ooolala send bob "hello"` creates the first chat loop without leaving the
  shell.
- `ooolala tui` opens a room switcher and composer after CLI auth exists.
- `ooolala skills` prints the instructions an agent needs to use Ooolala well.

Preflight:

- Put the strongest bullet first.
- Put the second-strongest last.
- Cut bullets that repeat the headline.
- Do not overuse curiosity bullets; terminal users reward clarity.

## Proof And Testimonials

Proof must reduce risk or skepticism.

Useful proof types for Ooolala:

- real command transcript
- deployment/version evidence
- actual user quote
- screenshot of TUI/web state
- measured activation behavior
- before/after workflow example

Testimonial shape:

- Before: what friction existed?
- After: what changed?
- Experience: how did it feel or what became easier?

Guardrail: never rewrite a testimonial into a claim the user did not make.

## Email And Launch Sequences

Use only if Ooolala has an actual list or launch motion.

Simple 5-email sequence:

1. Welcome and one concrete action.
2. Teach the first DM loop.
3. Show a real workflow story.
4. Show proof or a user example.
5. Invite the next action: TUI, skills, or web fallback.

Subject-line patterns:

- `How to DM from a Codex session`
- `Your first Ooolala loop`
- `ooolala tui`
- `For terminal-first chat`

Guardrail: close every open loop. Do not use curiosity if the email does not
pay it off.

## Social And Short-Form Copy

Prefer small, concrete claims.

Useful patterns:

- `{Pain before.} {Better workflow after.}`
- `Don’t let {tool mismatch} break {workflow}.`
- `I built {thing} because {specific annoyance}.`
- `{Command}. {What it does}.`

Ooolala examples:

- `WhatsApp is a bad home for Codex session chat. So I built Ooolala.`
- `ooolala send bob "hello" starts the loop. ooolala tui keeps it open.`

Guardrail: no hype about scale, disruption, or category domination.

## Pre-Publishing Checks

Use these before CMO signs off.

4 Cs:

- clear
- concise
- compelling
- credible

4 Us:

- useful
- urgent only if genuinely time-sensitive
- unique to Ooolala's terminal-first workflow
- ultra-specific

So What / Prove It:

- For every claim, ask: "So what?"
- Then ask: "What proves this?"
- Delete unsupported claims or add proof.

SCAMPER:

- Substitute vague phrases with exact ones.
- Combine related ideas when separate lines create clutter.
- Adapt proven structures without copying style.
- Minify overlong copy.
- Magnify the one strongest point.
- Eliminate weak sections.
- Rearrange the argument so action arrives after enough context.

## Taste Guardrails

Do:

- Lead with the user workflow.
- Prefer commands when commands solve the problem.
- Use proof before large claims.
- Keep the tone calm and direct.
- Make the browser path feel useful but secondary.

Do not:

- Write from scratch when a formula fits.
- Use formulas without research.
- Create false scarcity or urgency.
- Add "desire" by exaggerating pain.
- Use confirmshaming.
- Make the web app sound like the primary product.
- Copy direct-response language that clashes with terminal users.
- Let clever headlines beat clear headlines.

## Output Format

When CMO proposes copy, report:

- surface
- audience and stage
- chosen framework
- current copy, if any
- proposed copy
- proof or user insight supporting it
- why it is clearer, more credible, or more tasteful
- risks and test ideas
