# Ooolala Backend

Elixir backend for the Ooolala HTTP edge, auth, persistence, and shared chat
domain.

```sh
mix test
OOOLALA_STORE=postgres DATABASE_URL=postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev mix ooolala.db.migrate
```

`mix` is Elixir's project runner, roughly the backend equivalent of `npm`.

Entrypoints:

- `main.ex` - backend process entrypoint
- `lib/http_server.ex` - HTTP edge
- `lib/ooolala.ex` - backend API boundary
- `lib/chat.ex` - pure message and room logic
- `lib/auth*.ex` - auth policy and credential stores
- `lib/room_store*.ex` - memory/Postgres room persistence
