defmodule Ooolala.RoomStorePostgres do
  @moduledoc """
  Postgres-backed append log for rooms and direct messages.

  This adapter intentionally uses the standard `psql` client instead of a Hex
  dependency so the local dev loop does not depend on the host Erlang package
  set being complete before the database path can run.
  """

  use GenServer

  alias Ooolala.Attachment
  alias Ooolala.Chat
  alias Ooolala.Message
  alias Ooolala.Version

  @default_url "postgres://ooolala:ooolala@127.0.0.1:5432/ooolala_dev"
  @field_separator "\u001F"
  @record_separator "\u001E"

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)

    database_url =
      Keyword.get(opts, :database_url) ||
        Application.get_env(:ooolala, :database_url) ||
        System.get_env("DATABASE_URL") ||
        @default_url

    GenServer.start_link(__MODULE__, %{database_url: database_url}, name: name)
  end

  def send_message(room, author, body, server \\ __MODULE__) do
    send_message_with_attachments(room, author, body, [], server)
  end

  def send_message_with_attachments(room, author, body, uploads, server \\ __MODULE__) do
    metadata = Attachment.metadata_list(uploads)

    with {:ok, message, _next_state} <- Chat.send_message(%{}, room, author, body, metadata) do
      run_sql!(
        database_url(server),
        insert_message_sql(message, uploads)
      )

      {:ok, message}
    end
  end

  def list_messages(room, limit \\ :all, server \\ __MODULE__) do
    room = clean(room)

    sql =
      case limit do
        :all ->
          """
          SELECT id, room, author, encode(convert_to(body, 'UTF8'), 'hex'),
            to_char(inserted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          FROM messages
          WHERE room = #{literal(room)}
          ORDER BY inserted_at ASC, id ASC
          """

        n when is_integer(n) and n > 0 ->
          """
          SELECT id, room, author, body_hex, inserted_at
          FROM (
            SELECT id, room, author, encode(convert_to(body, 'UTF8'), 'hex') AS body_hex,
              to_char(inserted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS inserted_at
            FROM messages
            WHERE room = #{literal(room)}
            ORDER BY inserted_at DESC, id DESC
            LIMIT #{n}
          ) recent
          ORDER BY inserted_at ASC, id ASC
          """

        _ ->
          nil
      end

    if sql do
      database_url = database_url(server)

      messages =
        database_url
        |> run_sql!(sql)
        |> parse_rows()
        |> Enum.map(&row_to_message/1)

      attach_attachments(messages, database_url)
    else
      []
    end
  end

  def list_rooms(server \\ __MODULE__) do
    database_url(server)
    |> run_sql!("SELECT DISTINCT room FROM messages ORDER BY room ASC")
    |> parse_rows()
    |> Enum.map(fn [room] -> room end)
  end

  def ensure_dm_chat(username, peer, room, server \\ __MODULE__) do
    run_sql!(
      database_url(server),
      """
      INSERT INTO dm_chats (username, peer, room, inserted_at, updated_at, removed_at)
      VALUES (#{literal(clean(username))}, #{literal(clean(peer))}, #{literal(clean(room))}, now(), now(), NULL)
      ON CONFLICT (username, peer) DO UPDATE
        SET room = EXCLUDED.room,
            updated_at = now(),
            removed_at = NULL
      """
    )

    :ok
  end

  def remove_dm_chat(username, peer, room, server \\ __MODULE__) do
    run_sql!(
      database_url(server),
      """
      INSERT INTO dm_chats (username, peer, room, inserted_at, updated_at, removed_at)
      VALUES (#{literal(clean(username))}, #{literal(clean(peer))}, #{literal(clean(room))}, now(), now(), now())
      ON CONFLICT (username, peer) DO UPDATE
        SET updated_at = now(),
            removed_at = now()
      """
    )

    :ok
  end

  def list_dm_peers(username, server \\ __MODULE__) do
    database_url(server)
    |> run_sql!("""
    SELECT peer
    FROM dm_chats
    WHERE username = #{literal(clean(username))}
      AND removed_at IS NULL
    ORDER BY peer ASC
    """)
    |> parse_rows()
    |> Enum.map(fn [peer] -> peer end)
  end

  def attachment(message_id, attachment_id, server \\ __MODULE__) do
    database_url(server)
    |> run_sql!("""
    SELECT m.room, a.id, encode(convert_to(a.filename, 'UTF8'), 'hex'), a.content_type,
      a.byte_size, encode(a.data, 'hex')
    FROM message_attachments a
    JOIN messages m ON m.id = a.message_id
    WHERE a.message_id = #{literal(message_id)}
      AND a.id = #{literal(attachment_id)}
    LIMIT 1
    """)
    |> parse_rows()
    |> case do
      [[room, id, filename_hex, content_type, byte_size, data_hex]] ->
        {:ok,
         %{
           room: room,
           id: id,
           filename: decode_hex!(filename_hex),
           content_type: content_type,
           byte_size: parse_integer(byte_size),
           data: decode_hex!(data_hex)
         }}

      _ ->
        {:error, :attachment_not_found}
    end
  end

  def count_recent_messages_by_author(author, seconds, server \\ __MODULE__) do
    database_url(server)
    |> run_sql!("""
    SELECT COUNT(*)
    FROM messages
    WHERE author = #{literal(clean(author))}
      AND inserted_at >= now() - (#{integer(seconds)} || ' seconds')::interval
    """)
    |> parse_count()
  end

  def metrics(server \\ __MODULE__) do
    database_url = database_url(server)

    %{
      messages_total: count_sql(database_url, "SELECT COUNT(*) FROM messages"),
      messages_24h:
        count_sql(
          database_url,
          "SELECT COUNT(*) FROM messages WHERE inserted_at >= now() - interval '24 hours'"
        ),
      messages_7d:
        count_sql(
          database_url,
          "SELECT COUNT(*) FROM messages WHERE inserted_at >= now() - interval '7 days'"
        ),
      unique_senders_24h:
        count_sql(
          database_url,
          "SELECT COUNT(DISTINCT author) FROM messages WHERE inserted_at >= now() - interval '24 hours'"
        ),
      unique_senders_7d:
        count_sql(
          database_url,
          "SELECT COUNT(DISTINCT author) FROM messages WHERE inserted_at >= now() - interval '7 days'"
        ),
      top_senders_24h: top_senders(database_url)
    }
  end

  def reset(server \\ __MODULE__) do
    run_sql!(database_url(server), "TRUNCATE TABLE message_attachments, messages, dm_chats")
    :ok
  end

  def health(server \\ __MODULE__) do
    case run_sql(database_url(server), "SELECT 1") do
      {:ok, _output} ->
        current_schema = schema_version(server)

        if current_schema >= Version.db_schema() do
          :ok
        else
          {:error, "db schema #{current_schema} is behind #{Version.db_schema()}"}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  def schema_version(server \\ __MODULE__) do
    output =
      database_url(server)
      |> run_sql!("""
      SELECT COALESCE(MAX(version), 0)
      FROM schema_migrations
      """)

    output
    |> parse_rows()
    |> case do
      [[version]] ->
        case Integer.parse(String.trim(version)) do
          {value, ""} -> value
          _ -> 0
        end

      _ ->
        0
    end
  rescue
    RuntimeError -> 0
  end

  def database_url(server \\ __MODULE__) do
    case server do
      pid when is_pid(pid) ->
        GenServer.call(pid, :database_url)

      name when is_atom(name) ->
        if Process.whereis(name) do
          GenServer.call(name, :database_url)
        else
          configured_database_url()
        end

      _ ->
        configured_database_url()
    end
  end

  def run_sql!(database_url, sql) do
    case run_sql(database_url, sql) do
      {:ok, output} -> output
      {:error, reason} -> raise reason
    end
  end

  def run_sql(database_url, sql) do
    args =
      [
        "--no-psqlrc",
        "--quiet",
        "--tuples-only",
        "--no-align",
        "--set=ON_ERROR_STOP=1",
        "--field-separator=#{@field_separator}",
        "--record-separator=#{@record_separator}"
      ] ++ ["--command", sql, database_url]

    case System.cmd("psql", args, stderr_to_stdout: true) do
      {output, 0} -> {:ok, output}
      {output, status} -> {:error, "psql exited #{status}: #{String.trim(output)}"}
    end
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

  defp configured_database_url do
    Application.get_env(:ooolala, :database_url) ||
      System.get_env("DATABASE_URL") ||
      @default_url
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

  defp count_sql(database_url, sql), do: database_url |> run_sql!(sql) |> parse_count()

  defp top_senders(database_url) do
    database_url
    |> run_sql!("""
    SELECT author, COUNT(*)
    FROM messages
    WHERE inserted_at >= now() - interval '24 hours'
    GROUP BY author
    ORDER BY COUNT(*) DESC, author ASC
    LIMIT 10
    """)
    |> parse_rows()
    |> Enum.map(fn [author, count] ->
      {parsed_count, _} = Integer.parse(count)
      {author, parsed_count}
    end)
  end

  defp insert_message_sql(message, uploads) do
    statements = [
      "BEGIN",
      """
      INSERT INTO messages (id, room, author, body, inserted_at)
      VALUES (
        #{literal(message.id)},
        #{literal(message.room)},
        #{literal(message.author)},
        #{literal(message.body)},
        #{literal(DateTime.to_iso8601(message.inserted_at))}::timestamptz
      )
      """
      | Enum.map(uploads, &insert_attachment_sql(message, &1))
    ]

    Enum.join(statements ++ ["COMMIT"], ";\n") <> ";\n"
  end

  defp insert_attachment_sql(message, upload) do
    """
    INSERT INTO message_attachments (
      id, message_id, filename, content_type, byte_size, data, inserted_at
    )
    VALUES (
      #{literal(upload.id)},
      #{literal(message.id)},
      #{literal(upload.filename)},
      #{literal(upload.content_type)},
      #{integer(upload.byte_size)},
      decode(#{literal(Base.encode16(upload.data, case: :lower))}, 'hex'),
      #{literal(DateTime.to_iso8601(message.inserted_at))}::timestamptz
    )
    """
  end

  defp row_to_message([id, room, author, body_hex, inserted_at]) do
    body = decode_hex!(body_hex)
    {:ok, inserted_at, 0} = DateTime.from_iso8601(inserted_at)
    Message.new(room, author, body, id: id, inserted_at: inserted_at)
  end

  defp attach_attachments([], _database_url), do: []

  defp attach_attachments(messages, database_url) do
    ids = Enum.map(messages, &literal(&1.id)) |> Enum.join(",")

    attachments_by_message =
      database_url
      |> run_sql!("""
      SELECT message_id, id, encode(convert_to(filename, 'UTF8'), 'hex'), content_type, byte_size
      FROM message_attachments
      WHERE message_id IN (#{ids})
      ORDER BY inserted_at ASC, id ASC
      """)
      |> parse_rows()
      |> Enum.group_by(
        fn [message_id | _rest] -> message_id end,
        fn [_message_id, id, filename_hex, content_type, byte_size] ->
          %{
            id: id,
            filename: decode_hex!(filename_hex),
            content_type: content_type,
            byte_size: parse_integer(byte_size)
          }
        end
      )

    Enum.map(messages, fn message ->
      %{message | attachments: Map.get(attachments_by_message, message.id, [])}
    end)
  end

  defp decode_hex!(value) do
    {:ok, decoded} = Base.decode16(value, case: :lower)
    decoded
  end

  defp parse_integer(value) do
    case Integer.parse(to_string(value)) do
      {integer, ""} -> integer
      _ -> 0
    end
  end

  defp clean(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.replace("\t", " ")
  end

  def literal(value) do
    escaped =
      value
      |> to_string()
      |> String.replace("'", "''")

    "'#{escaped}'"
  end

  defp integer(value) when is_integer(value), do: max(value, 0)

  defp integer(value) do
    case Integer.parse(to_string(value)) do
      {integer, ""} when integer >= 0 -> integer
      _ -> 0
    end
  end
end
