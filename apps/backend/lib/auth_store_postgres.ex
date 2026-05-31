defmodule Ooolala.AuthStorePostgres do
  @moduledoc "Postgres-backed credential store."

  use GenServer

  alias Ooolala.AuthStore
  alias Ooolala.Password
  alias Ooolala.RoomStorePostgres, as: Sql

  @field_separator "\u001F"
  @record_separator "\u001E"

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)

    database_url =
      Keyword.get(opts, :database_url) ||
        Application.get_env(:ooolala, :database_url) ||
        System.get_env("DATABASE_URL") ||
        Sql.database_url()

    GenServer.start_link(__MODULE__, %{database_url: database_url}, name: name)
  end

  def create_user(username, password, server \\ __MODULE__) do
    password_hash = Password.hash(password)

    rows =
      server
      |> database_url()
      |> Sql.run_sql!("""
      INSERT INTO users (username, password_hash, inserted_at, updated_at)
      VALUES (#{Sql.literal(username)}, #{Sql.literal(password_hash)}, now(), now())
      ON CONFLICT (username) DO NOTHING
      RETURNING username
      """)
      |> parse_rows()

    case rows do
      [[^username]] -> {:ok, %{username: username}}
      [] -> {:error, :username_taken}
    end
  end

  def authenticate(username, password, server \\ __MODULE__) do
    case password_hash(username, server) do
      {:ok, hash} ->
        if Password.verify(password, hash) do
          update_last_login(username, server)
          {:ok, %{username: username}}
        else
          {:error, :invalid_credentials}
        end

      :error ->
        {:error, :invalid_credentials}
    end
  end

  def change_password(username, current_password, new_password, server \\ __MODULE__) do
    with {:ok, hash} <- password_hash(username, server),
         true <- Password.verify(current_password, hash) do
      server
      |> database_url()
      |> Sql.run_sql!("""
      UPDATE users
      SET password_hash = #{Sql.literal(Password.hash(new_password))}, updated_at = now()
      WHERE username = #{Sql.literal(username)} AND disabled_at IS NULL
      """)

      {:ok, %{username: username}}
    else
      _ -> {:error, :invalid_credentials}
    end
  end

  def known_user?(username, server \\ __MODULE__) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!(
        "SELECT 1 FROM users WHERE username = #{Sql.literal(username)} AND disabled_at IS NULL LIMIT 1"
      )
      |> parse_rows()

    rows != []
  rescue
    RuntimeError -> false
  end

  def user_exists?(username, server \\ __MODULE__) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!("SELECT 1 FROM users WHERE username = #{Sql.literal(username)} LIMIT 1")
      |> parse_rows()

    rows != []
  rescue
    RuntimeError -> false
  end

  def disable_user(username, reason, server \\ __MODULE__) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!("""
      UPDATE users
      SET disabled_at = now(), disabled_reason = #{Sql.literal(reason)}
      WHERE username = #{Sql.literal(username)}
      RETURNING username
      """)
      |> parse_rows()

    case rows do
      [[^username]] -> {:ok, %{username: username}}
      [] -> {:error, :unknown_user}
    end
  end

  def enable_user(username, server \\ __MODULE__) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!("""
      UPDATE users
      SET disabled_at = NULL, disabled_reason = NULL
      WHERE username = #{Sql.literal(username)}
      RETURNING username
      """)
      |> parse_rows()

    case rows do
      [[^username]] -> {:ok, %{username: username}}
      [] -> {:error, :unknown_user}
    end
  end

  def user_status(username, server \\ __MODULE__) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!("""
      SELECT username,
        COALESCE(to_char(disabled_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), ''),
        COALESCE(disabled_reason, ''),
        COALESCE(to_char(last_login_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), ''),
        to_char(inserted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      FROM users
      WHERE username = #{Sql.literal(username)}
      """)
      |> parse_rows()

    case rows do
      [[^username, disabled_at, disabled_reason, last_login_at, inserted_at]] ->
        {:ok,
         %{
           username: username,
           disabled_at: empty_to_nil(disabled_at),
           disabled_reason: empty_to_nil(disabled_reason),
           last_login_at: empty_to_nil(last_login_at),
           inserted_at: inserted_at
         }}

      [] ->
        {:error, :unknown_user}
    end
  end

  def count_users(server \\ __MODULE__) do
    server
    |> database_url()
    |> Sql.run_sql!("SELECT COUNT(*) FROM users")
    |> parse_count()
  end

  def count_signups_since(seconds, server \\ __MODULE__) do
    server
    |> database_url()
    |> Sql.run_sql!("""
    SELECT COUNT(*)
    FROM users
    WHERE inserted_at >= now() - (#{integer(seconds)} || ' seconds')::interval
    """)
    |> parse_count()
  end

  def metrics(server \\ __MODULE__) do
    database_url = database_url(server)

    %{
      users_total: count_sql(database_url, "SELECT COUNT(*) FROM users"),
      users_created_24h:
        count_sql(
          database_url,
          "SELECT COUNT(*) FROM users WHERE inserted_at >= now() - interval '24 hours'"
        ),
      users_created_7d:
        count_sql(
          database_url,
          "SELECT COUNT(*) FROM users WHERE inserted_at >= now() - interval '7 days'"
        ),
      disabled_users:
        count_sql(database_url, "SELECT COUNT(*) FROM users WHERE disabled_at IS NOT NULL"),
      login_failed_24h: count_event(database_url, "login_failed", "24 hours"),
      signup_created_24h: count_event(database_url, "signup_created", "24 hours"),
      signup_rejected_24h: count_event(database_url, "signup_rejected", "24 hours")
    }
  end

  def record_event(event, username, server \\ __MODULE__) do
    server
    |> database_url()
    |> Sql.run_sql!("""
    INSERT INTO auth_events (event, username, inserted_at)
    VALUES (#{Sql.literal(event)}, #{Sql.literal(username)}, now())
    """)

    :ok
  rescue
    RuntimeError -> :ok
  end

  def reset(server \\ __MODULE__) do
    database_url = database_url(server)
    Sql.run_sql!(database_url, "TRUNCATE TABLE users")
    Sql.run_sql(database_url, "TRUNCATE TABLE auth_events")
    seed!(database_url)
    :ok
  end

  def seed!(database_url \\ Sql.database_url()) do
    Enum.each(AuthStore.seed_users(), fn {username, password} ->
      Sql.run_sql!(
        database_url,
        """
        INSERT INTO users (username, password_hash)
        VALUES (#{Sql.literal(username)}, #{Sql.literal(Password.hash(password))})
        ON CONFLICT (username) DO NOTHING
        """
      )
    end)
  end

  @impl true
  def init(state) do
    if System.find_executable("psql") do
      {:ok, state}
    else
      {:stop, "psql is required for OOOLALA_STORE=postgres"}
    end
  end

  @impl true
  def handle_call(:database_url, _from, state) do
    {:reply, state.database_url, state}
  end

  defp password_hash(username, server) do
    rows =
      server
      |> database_url()
      |> Sql.run_sql!(
        "SELECT password_hash FROM users WHERE username = #{Sql.literal(username)} AND disabled_at IS NULL"
      )
      |> parse_rows()

    case rows do
      [[hash]] -> {:ok, hash}
      _ -> :error
    end
  rescue
    RuntimeError -> :error
  end

  defp database_url(server) do
    case server do
      pid when is_pid(pid) ->
        GenServer.call(pid, :database_url)

      name when is_atom(name) ->
        if Process.whereis(name) do
          GenServer.call(name, :database_url)
        else
          Sql.database_url()
        end

      _ ->
        Sql.database_url()
    end
  end

  defp update_last_login(username, server) do
    server
    |> database_url()
    |> Sql.run_sql!(
      "UPDATE users SET last_login_at = now() WHERE username = #{Sql.literal(username)}"
    )

    :ok
  rescue
    RuntimeError -> :ok
  end

  defp parse_rows(""), do: []

  defp parse_rows(output) do
    output
    |> String.trim_trailing("\n")
    |> String.trim_trailing(@record_separator)
    |> String.split(@record_separator, trim: true)
    |> Enum.map(&String.split(&1, @field_separator, trim: false))
  end

  defp parse_count(output) do
    case parse_rows(output) do
      [[count]] ->
        case Integer.parse(String.trim(count)) do
          {value, ""} -> value
          _ -> 0
        end

      _ ->
        0
    end
  end

  defp count_sql(database_url, sql), do: database_url |> Sql.run_sql!(sql) |> parse_count()

  defp count_event(database_url, event, interval) do
    count_sql(
      database_url,
      """
      SELECT COUNT(*)
      FROM auth_events
      WHERE event = #{Sql.literal(event)}
        AND inserted_at >= now() - #{Sql.literal(interval)}::interval
      """
    )
  end

  defp empty_to_nil(""), do: nil
  defp empty_to_nil(value), do: value

  defp integer(value) when is_integer(value), do: max(value, 0)

  defp integer(value) do
    case Integer.parse(to_string(value)) do
      {integer, ""} when integer >= 0 -> integer
      _ -> 0
    end
  end
end
