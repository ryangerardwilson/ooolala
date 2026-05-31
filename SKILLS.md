# Ooolala Agent Skill

Use Ooolala only when terminal work needs a human reply or a short
human-visible update.

Do not send a message just because you are working. Send only when the human
reply can change what happens next, the user asked for an Ooolala update, or a
meaningful blocker/status change needs attention.

## Recipient Rule

- Use the username the human gave you.
- Use `bob` only for first-DM testing or the welcome flow.
- If you do not know the recipient, ask for the exact username before sending.

## Before Sending

1. Run `ooolala who` to confirm the active identity.
2. Confirm the recipient.
3. Decide whether the message is useful enough to interrupt the human.
4. Strip secrets, tokens, passwords, private keys, cookies, and long logs.
   Attach files only after redaction and only when the human asked for them or
   needs the file to decide.
5. Reduce the message to context, evidence, and one ask.

## When To Send

Send one concise DM when:

- you are blocked on a human decision
- a command or test failed and human input is needed
- the user explicitly asked for an Ooolala update
- a high-signal milestone is complete and the user needs to know
- the user asked you to chat through Ooolala

## When Not To Send

Do not send:

- repeated heartbeat updates
- routine command output
- long logs or stack traces
- secrets or private environment dumps
- speculative narration
- the same question twice
- messages the user did not ask for and does not need

## Commands

Check auth:

```sh
ooolala who
```

Send the first welcome DM:

```sh
ooolala send bob "hello"
```

Send the human one short message:

```sh
ooolala send <username> "blocked: npm test fails in apps/frontend/web. Should I fix it or pause?"
```

Use stdin only for short multi-line messages where shell quoting is awkward:

```sh
printf '%s\n' "context: web auth route" "evidence: /login loads, stale invalid-credentials is hidden" "ask: should I deploy this?" | ooolala send <username> -
```

Attach a small file only when the human explicitly needs the file:

```sh
ooolala send <username> "redacted log attached" attach ./run.log
```

Download a file the human sent you:

```sh
ooolala download <message-id> <attachment-id> .
```

Check for new incoming replies without starting a long-running watch:

```sh
ooolala read <username> unread incoming
```

Watch only when actively waiting for a reply:

```sh
ooolala watch <username> incoming
```

Open the TUI only when the user asks for the room UI:

```sh
ooolala tui
```

`ooolala web` is mainly a human handoff. Agents should normally use the CLI.

## Message Shape

A good Ooolala message has context, evidence, and one ask.

Use one of these shapes:

```text
status: tests passed; next: prod deploy check
```

```text
blocked: npm test fails in apps/frontend/terminal. Should I fix it or pause?
```

```text
done: auth flow verified; no file edits
```

For a blocker:

```text
context: what I was trying to do
evidence: command, test, file, or short error summary
ask: one specific decision or request
```

## Recovery

- If `ooolala who` says `not authed`, ask the user to run
  `ooolala auth <username>`.
- If the recipient is unknown, ask for the exact username.
- If the backend is unavailable, say Ooolala is unavailable and continue local
  work where possible.
- If no reply arrives, keep working where possible. Do not spam.

## Safety

Never send secrets, tokens, passwords, private keys, cookies, full env dumps, or
long logs. Summarize and redact.

Do not change Ooolala auth, signout, or password state unless the user
explicitly asks.
