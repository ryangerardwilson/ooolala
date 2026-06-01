defmodule Ooolala do
  @moduledoc "Backend API boundary for the current Elixir service increment."

  alias Ooolala.Auth
  alias Ooolala.Attachment
  alias Ooolala.RoomStore
  alias Ooolala.Version

  def status do
    %{
      app: :ooolala,
      status: :ok,
      rooms: RoomStore.list_rooms()
    }
  end

  def send(room, author, body), do: RoomStore.send_message(room, author, body)

  def send(room, author, body, uploads) do
    with {:ok, uploads} <- Attachment.prepare_uploads(uploads) do
      RoomStore.send_message_with_attachments(room, author, body, uploads)
    end
  end

  def messages(room, limit \\ :all), do: RoomStore.list_messages(room, limit)
  def rooms, do: RoomStore.list_rooms()
  def health, do: RoomStore.health()

  def version_vector do
    %{
      product_version: Version.product_version(),
      commit: Version.commit(),
      environment: Version.environment(),
      command_surface: Version.command_surface(),
      chat_protocol: %{
        min: Version.chat_protocol_min(),
        max: Version.chat_protocol_max()
      },
      db_schema: %{
        current: RoomStore.schema_version(),
        latest: Version.db_schema(),
        store: RoomStore.store_mode() |> Atom.to_string()
      },
      auth_policy: Version.auth_policy(),
      ui_flow: Version.ui_flow()
    }
  end

  def version_lines do
    vector = version_vector()

    [
      "product_version #{vector.product_version}",
      "commit #{vector.commit}",
      "environment #{vector.environment}",
      "command_surface #{vector.command_surface}",
      "chat_protocol #{vector.chat_protocol.min}..#{vector.chat_protocol.max}",
      "db_schema #{vector.db_schema.current}/#{vector.db_schema.latest} #{vector.db_schema.store}",
      "auth_policy #{vector.auth_policy}",
      "ui_flow #{vector.ui_flow}"
    ]
  end

  def login(username, password), do: Auth.authenticate(username, password)
  def signup(username, password), do: Auth.signup(username, password)
  def signup_username(username), do: Auth.signup_username(username)

  def change_password(username, current_password, new_password) do
    Auth.change_password(username, current_password, new_password)
  end

  def send_dm(username, other_username, body, uploads \\ []) do
    username = dm_username(username)
    other_username = dm_username(other_username)

    with :ok <- Ooolala.RateLimit.check_message(username),
         {:ok, uploads} <- Attachment.prepare_uploads(uploads),
         {:ok, room} <- Auth.dm_room(username, other_username),
         {:ok, message} <- RoomStore.send_message_with_attachments(room, username, body, uploads),
         :ok <- RoomStore.ensure_dm_chat(username, other_username, room),
         :ok <- RoomStore.ensure_dm_chat(other_username, username, room) do
      {:ok, message}
    end
  end

  def start_dm(username, other_username) do
    username = dm_username(username)
    other_username = dm_username(other_username)

    with {:ok, room} <- Auth.dm_room(username, other_username),
         :ok <- RoomStore.ensure_dm_chat(username, other_username, room) do
      {:ok, %{peer: other_username, room: room}}
    end
  end

  def remove_dm(username, other_username) do
    username = dm_username(username)
    other_username = dm_username(other_username)

    with {:ok, room} <- Auth.dm_room(username, other_username) do
      RoomStore.remove_dm_chat(username, other_username, room)
    end
  end

  def dm_messages(username, other_username, limit \\ :all) do
    with {:ok, room} <- Auth.dm_room(username, other_username) do
      {:ok, messages(room, limit)}
    end
  end

  def dm_peers(username) do
    RoomStore.list_dm_peers(dm_username(username))
  end

  def attachment(username, message_id, attachment_id) do
    username = dm_username(username)

    with {:ok, attachment} <- RoomStore.attachment(message_id, attachment_id),
         :ok <- authorize_room(username, attachment.room) do
      {:ok, attachment}
    end
  end

  defp authorize_room(username, "dm:" <> peers) do
    if username in String.split(peers, ":") do
      :ok
    else
      {:error, :attachment_not_found}
    end
  end

  defp authorize_room(_username, _room), do: :ok

  defp dm_username(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.downcase()
  end
end
