# CPO Microcopy Lens

## Purpose

Use this file when judging or designing the small interface words that move a
user through Ooolala: labels, buttons, field hints, empty states, loading text,
success states, error messages, tooltips, notifications, captions, alt text,
and offboarding prompts.

Microcopy is product design in words. It is not decoration and it is not
marketing copy. It exists to solve user problems at the exact moment of action.

## First Principle

Good microcopy answers:

- What is happening?
- What can I do next?
- Why is this safe or worth doing?
- What changed after my action?
- How do I recover if something failed?

If the words do not help the user act with less uncertainty, delete or rewrite
them.

## Ooolala Frame

Ooolala is CLI-first, TUI-second, web-third chat for Codex and Claude sessions.
Microcopy must preserve that order.

- CLI copy should be command-shaped, concrete, and fast to parse.
- TUI copy should reduce keystroke hesitation and room/message ambiguity.
- Web copy should support login, account recovery, and browser fallback without
  making web feel like the primary product or exposing browser signup.
- The landing page may persuade, but product surfaces must guide action.
- Activation is not signup. Activation is the first useful DM/read loop.

## Golden Rules

Be clear.

- Prefer exact action language over vague gestures.
- Never use `click here`, `continue`, or `start` when a more specific action is
  available.
- Avoid internal jargon unless the target user already knows it.
- Use the user's language: username, password, DM, chat, TUI, CLI.

Be concise.

- Use as few words as possible without losing meaning.
- Button labels should usually be 1-3 words.
- Shorter is worse if it hides consequences, recovery, or required action.

Be helpful.

- Anticipate the user's next concern.
- Explain constraints before they cause failure.
- Give the next command or next action when something goes wrong.
- Use mental relaxers only when true, such as `You can change only your
  password later.`

## Product Microcopy Types

Onboarding copy:

- Shows the shortest real path to value.
- For Ooolala, prefer executable commands over explanation.
- Good: `ooolala auth`, `ooolala send bob "hello"`.
- Weak: long prose about how signup works when a command would do.

Buttons and CTAs:

- Name the actual action, not the input method.
- Good: `sign in`, `save`, `send`.
- Weak: `click here`, `continue`, `submit`, `enter chat` when the action is
  authentication.

Field labels and hints:

- Labels must stand outside the input, not rely on low-contrast placeholders.
- Use hints for constraints that block completion.
- Good: `password (12+ chars)`.
- Weak: showing the rule only after failure.

Errors:

- Say what failed and how to recover.
- Avoid raw implementation details.
- Do not blame the user.
- Good: `username unavailable`.
- Better when useful: `username unavailable; try another handle`.
- Weak: `invalid request`, stack traces, or generic `something went wrong`.

Success messages:

- Confirm the result and point to the next useful action.
- Good: `created maanas; to login run: ooolala auth maanas`.
- Weak: celebratory copy that does not advance the workflow.

Empty states:

- Explain why nothing is shown and provide one next action.
- Good: `no chats yet. Start one if you know someone's username.`
- Better when a default exists: `no chats yet. Try: ooolala send bob "hello"`.
- Weak: `empty`.

Loading states:

- Use plain status language.
- If a wait has a real expected duration, say it; otherwise do not pretend.
- Good: `signing in...`, `claiming username...`, `saving...`.
- Weak: jokes, drama, or fake precision.

Tooltips:

- Use only where an icon or control is not self-evident.
- Name the control and its effect.
- Keep them short enough to scan while hovering.

Notifications:

- Reserve them for timely information outside the normal task flow.
- Include the consequence or action.
- Weak notifications train users to ignore important ones.

Alt text and captions:

- Alt text must describe meaningful images for screen readers.
- Decorative images should not add noise.
- Captions should clarify content, not repeat adjacent text.

Offboarding:

- Be respectful and clear.
- No guilt, shame, or manipulation.

## Taste Rules

Do not use confirmshaming.

- Never make the opt-out label insulting or self-deprecating.
- Bad: `No thanks, I hate better chat`.
- Good: `Maybe later`, `Not now`, or `Cancel`.

Be careful with humor.

- Humor is rarely worth the risk in auth, errors, money, data, recovery, or
  disabled-account states.
- If unsure, keep a straight face.
- Conversational is good. Joke-first is fragile.

Be inclusive.

- Do not force unnecessary personal attributes.
- If a field asks for sensitive information, explain why it is needed.
- Avoid placeholders as the only source of information.
- Favor accessible contrast and persistent labels.

Keep localization possible.

- Use short, plain sentences.
- Avoid puns, idioms, cultural references, and metaphors in functional UI.
- Commands may remain literal when they are the actual product grammar.

## Ooolala-Specific Standards

Command copy:

- Copy buttons must copy paste-ready commands only.
- Do not copy placeholders like `<username>`.
- If a command needs user input, use the prompting form, such as
  `ooolala auth`.
- Separate copy blocks when steps are independently executable.

Auth copy:

- Sign-in action is `sign in`.
- Web must not expose browser signup.
- Account creation copy should point to `ooolala auth`.
- Password rules must appear before submission where account creation or
  password change exists.
- Permanent username constraints must be clear before account creation in the
  CLI flow and docs.

Chat copy:

- Use `DM` when the action is a direct message.
- Use `chat` for the room/interface.
- Prefer `bob` as the welcome-account example when the user needs a first DM.

Error copy:

- Include the shortest next action that resolves the problem.
- For terminal users, prefer command hints.
- For browser users, avoid pretending the browser is the canonical path when a
  terminal command is the better fix.

## Review Checklist

- Is this microcopy solving a user problem at the moment of action?
- Is the next action obvious?
- Is the label specific enough for screen-reader link/button lists?
- Is the copy shorter without becoming vague?
- Does it anticipate a likely concern before failure?
- Does it avoid marketing tone inside product UI?
- Does it avoid shame, blame, and manipulative opt-outs?
- Does it preserve CLI-first, TUI-second, web-third priority?
- If the user is stressed, confused, or blocked, does the tone stay calm and
  useful?

## Output Format

When reviewing microcopy, report:

- surface and state
- current copy
- user problem
- proposed copy
- why it is clearer, shorter, or more helpful
- risk if the copy remains unchanged
