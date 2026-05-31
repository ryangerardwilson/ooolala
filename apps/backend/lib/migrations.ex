defmodule Ooolala.Migrations do
  @moduledoc "Small explicit migration runner for the current Postgres schema."

  alias Ooolala.AuthStore
  alias Ooolala.RoomStorePostgres, as: Postgres

  @schema_table """
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )
  """

  def run(server \\ Postgres) do
    database_url = Postgres.database_url(server)
    run_migrations(database_url)
    :ok
  end

  def run_url(database_url \\ Postgres.database_url()) do
    run_migrations(database_url)
    :ok
  end

  defp run_migrations(database_url) do
    Postgres.run_sql!(database_url, @schema_table)
    applied_versions = applied_versions(database_url)

    Enum.each(migrations(), fn {version, name, statements} ->
      if !MapSet.member?(applied_versions, version) do
        Enum.each(statements, &Postgres.run_sql!(database_url, &1))

        Postgres.run_sql!(
          database_url,
          """
          INSERT INTO schema_migrations (version, name)
          VALUES (#{version}, #{Postgres.literal(name)})
          ON CONFLICT (version) DO NOTHING
          """
        )
      end
    end)

    seed_users(database_url)
    reserve_welcome_user(database_url)
  end

  defp migrations do
    [
      {1, "messages_append_log",
       [
         """
         CREATE TABLE IF NOT EXISTS messages (
           id TEXT PRIMARY KEY,
           room TEXT NOT NULL,
           author TEXT NOT NULL,
           body TEXT NOT NULL,
           inserted_at TIMESTAMPTZ NOT NULL
         )
         """,
         """
         CREATE INDEX IF NOT EXISTS messages_room_inserted_at_id_idx
         ON messages (room, inserted_at, id)
         """,
         """
         CREATE INDEX IF NOT EXISTS messages_author_inserted_at_id_idx
         ON messages (author, inserted_at, id)
         """
       ]},
      {2, "users_password_auth",
       [
         """
         CREATE TABLE IF NOT EXISTS users (
           username TEXT PRIMARY KEY,
           password_hash TEXT NOT NULL,
           inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )
         """
       ] ++ seed_user_statements()},
      {3, "open_signup_beta_controls",
       [
         """
         ALTER TABLE users
         ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
         ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
         """,
         """
         CREATE INDEX IF NOT EXISTS users_inserted_at_idx
         ON users (inserted_at)
         """,
         """
         CREATE INDEX IF NOT EXISTS users_disabled_at_idx
         ON users (disabled_at)
         """,
         """
         CREATE TABLE IF NOT EXISTS auth_events (
           id BIGSERIAL PRIMARY KEY,
           event TEXT NOT NULL,
           username TEXT,
           inserted_at TIMESTAMPTZ NOT NULL DEFAULT now()
         )
         """,
         """
         CREATE INDEX IF NOT EXISTS auth_events_event_inserted_at_idx
         ON auth_events (event, inserted_at)
         """,
         """
         CREATE INDEX IF NOT EXISTS auth_events_username_inserted_at_idx
         ON auth_events (username, inserted_at)
         """
       ]},
      {4, "disable_legacy_seed_users_in_prod",
       if production_environment?() do
         [
           """
           UPDATE users
           SET disabled_at = COALESCE(disabled_at, now()),
             disabled_reason = COALESCE(disabled_reason, 'legacy seeded user disabled for open signup')
           WHERE username IN ('user1', 'user2')
             AND disabled_at IS NULL
           """
         ]
       else
         []
       end},
      {5, "reserve_bob_welcome_account", []},
      {6, "durable_dm_chat_list",
       [
         """
         CREATE TABLE IF NOT EXISTS dm_chats (
           username TEXT NOT NULL,
           peer TEXT NOT NULL,
           room TEXT NOT NULL,
           inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           removed_at TIMESTAMPTZ,
           PRIMARY KEY (username, peer)
         )
         """,
         """
         CREATE INDEX IF NOT EXISTS dm_chats_username_updated_at_idx
         ON dm_chats (username, updated_at DESC)
         """,
         """
         CREATE INDEX IF NOT EXISTS dm_chats_username_removed_at_idx
         ON dm_chats (username, removed_at)
         """,
         """
         INSERT INTO dm_chats (username, peer, room, inserted_at, updated_at)
         SELECT participant.username,
           participant.peer,
           source.room,
           MIN(source.inserted_at),
           MAX(source.inserted_at)
         FROM (
           SELECT room,
             split_part(substring(room from 4), ':', 1) AS user_a,
             split_part(substring(room from 4), ':', 2) AS user_b,
             inserted_at
           FROM messages
           WHERE room LIKE 'dm:%:%'
         ) source
         CROSS JOIN LATERAL (
           VALUES (source.user_a, source.user_b), (source.user_b, source.user_a)
         ) AS participant(username, peer)
         WHERE participant.username <> ''
           AND participant.peer <> ''
         GROUP BY participant.username, participant.peer, source.room
         ON CONFLICT (username, peer) DO UPDATE
           SET room = EXCLUDED.room,
               updated_at = GREATEST(dm_chats.updated_at, EXCLUDED.updated_at)
         """
       ]},
      {7, "message_attachments",
       [
         """
         CREATE TABLE IF NOT EXISTS message_attachments (
           id TEXT NOT NULL,
           message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
           filename TEXT NOT NULL,
           content_type TEXT NOT NULL,
           byte_size INTEGER NOT NULL,
           data BYTEA NOT NULL,
           inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
           PRIMARY KEY (message_id, id)
         )
         """,
         """
         CREATE INDEX IF NOT EXISTS message_attachments_message_id_idx
         ON message_attachments (message_id)
         """
       ]}
    ]
  end

  defp seed_user_statements do
    if seed_users_enabled?() do
      Enum.map(AuthStore.seed_users(), fn {username, password} ->
        password_hash = Ooolala.Password.hash(password)

        """
        INSERT INTO users (username, password_hash)
        VALUES (#{Postgres.literal(username)}, #{Postgres.literal(password_hash)})
        ON CONFLICT (username) DO NOTHING
        """
      end)
    else
      []
    end
  end

  defp random_welcome_password do
    32
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp seed_users(database_url) do
    Enum.each(seed_user_statements(), &Postgres.run_sql!(database_url, &1))
  end

  defp reserve_welcome_user(database_url) do
    password = welcome_password()

    if System.get_env("OOOLALA_WELCOME_PASSWORD") do
      Postgres.run_sql!(
        database_url,
        """
        INSERT INTO users (username, password_hash, inserted_at, updated_at)
        VALUES ('bob', #{Postgres.literal(Ooolala.Password.hash(password))}, now(), now())
        ON CONFLICT (username) DO UPDATE
          SET password_hash = EXCLUDED.password_hash,
              updated_at = now(),
              disabled_at = NULL,
              disabled_reason = NULL
        """
      )
    else
      Postgres.run_sql!(
        database_url,
        """
        INSERT INTO users (username, password_hash, inserted_at, updated_at)
        VALUES ('bob', #{Postgres.literal(Ooolala.Password.hash(password))}, now(), now())
        ON CONFLICT (username) DO NOTHING
        """
      )
    end
  end

  defp welcome_password do
    case System.get_env("OOOLALA_WELCOME_PASSWORD") do
      nil ->
        random_welcome_password()

      value ->
        password = String.trim(value)

        if String.length(password) >= Ooolala.Auth.password_min_length() do
          password
        else
          raise "OOOLALA_WELCOME_PASSWORD must be at least #{Ooolala.Auth.password_min_length()} characters"
        end
    end
  end

  defp applied_versions(database_url) do
    database_url
    |> Postgres.run_sql!("SELECT version FROM schema_migrations ORDER BY version ASC")
    |> String.split(["\u001E", "\n"], trim: true)
    |> Enum.flat_map(fn version ->
      case Integer.parse(String.trim(version)) do
        {value, ""} -> [value]
        _ -> []
      end
    end)
    |> MapSet.new()
  end

  defp seed_users_enabled? do
    case System.get_env("OOOLALA_SEED_USERS") do
      value when value in ["1", "true", "TRUE", "yes", "YES"] ->
        true

      value when value in ["0", "false", "FALSE", "no", "NO"] ->
        false

      _ ->
        Ooolala.Version.environment() in ["dev", "test", "local"]
    end
  end

  defp production_environment? do
    Ooolala.Version.environment() == "prod"
  end
end
