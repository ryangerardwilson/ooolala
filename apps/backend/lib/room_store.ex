defmodule Ooolala.RoomStore do
  @moduledoc """
  Storage facade for the backend room log.

  Local tests use the memory adapter by default. Development and deployed
  backends should use the Postgres adapter unless `OOOLALA_STORE=memory` is set
  explicitly.
  """

  alias Ooolala.RoomStoreMemory
  alias Ooolala.RoomStorePostgres

  def child_spec(opts) do
    adapter().child_spec(opts)
  end

  def start_link(opts \\ []) do
    adapter().start_link(opts)
  end

  def send_message(room, author, body, server \\ :default) do
    adapter().send_message(room, author, body, connection(server))
  end

  def send_message_with_attachments(room, author, body, uploads, server \\ :default) do
    adapter().send_message_with_attachments(room, author, body, uploads, connection(server))
  end

  def list_messages(room, limit \\ :all, server \\ :default) do
    adapter().list_messages(room, limit, connection(server))
  end

  def list_rooms(server \\ :default) do
    adapter().list_rooms(connection(server))
  end

  def ensure_dm_chat(username, peer, room, server \\ :default) do
    adapter().ensure_dm_chat(username, peer, room, connection(server))
  end

  def remove_dm_chat(username, peer, room, server \\ :default) do
    adapter().remove_dm_chat(username, peer, room, connection(server))
  end

  def list_dm_peers(username, server \\ :default) do
    adapter().list_dm_peers(username, connection(server))
  end

  def attachment(message_id, attachment_id, server \\ :default) do
    adapter().attachment(message_id, attachment_id, connection(server))
  end

  def count_recent_messages_by_author(author, seconds, server \\ :default) do
    adapter().count_recent_messages_by_author(author, seconds, connection(server))
  end

  def metrics(server \\ :default) do
    adapter().metrics(connection(server))
  end

  def reset(server \\ :default) do
    adapter().reset(connection(server))
  end

  def health(server \\ :default) do
    adapter().health(connection(server))
  end

  def schema_version(server \\ :default) do
    adapter().schema_version(connection(server))
  end

  def adapter do
    case store_mode() do
      :memory -> RoomStoreMemory
      :postgres -> RoomStorePostgres
    end
  end

  def store_mode do
    configured =
      System.get_env("OOOLALA_STORE") ||
        Application.get_env(:ooolala, :store, "postgres")

    case configured |> to_string() |> String.downcase() do
      "memory" -> :memory
      "postgres" -> :postgres
      other -> raise "unknown OOOLALA_STORE=#{inspect(other)}; use memory or postgres"
    end
  end

  defp connection(:default), do: adapter()
  defp connection(server), do: server
end
