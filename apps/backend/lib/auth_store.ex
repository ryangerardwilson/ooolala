defmodule Ooolala.AuthStore do
  @moduledoc """
  Storage facade for user credentials.

  The dev path uses the same Postgres-backed durability shape as messages.
  Tests and explicit throwaway runs can still use the memory adapter.
  """

  alias Ooolala.AuthStoreMemory
  alias Ooolala.AuthStorePostgres
  alias Ooolala.RoomStore

  @seed_users [
    {"user1", "1234"},
    {"user2", "1234"},
    {"bob", "1234"}
  ]

  def seed_users, do: @seed_users

  def child_spec(opts) do
    adapter().child_spec(opts)
  end

  def start_link(opts \\ []) do
    adapter().start_link(opts)
  end

  def create_user(username, password, server \\ :default) do
    adapter().create_user(username, password, connection(server))
  end

  def user_exists?(username, server \\ :default) do
    adapter().user_exists?(username, connection(server))
  end

  def authenticate(username, password, server \\ :default) do
    adapter().authenticate(username, password, connection(server))
  end

  def change_password(username, current_password, new_password, server \\ :default) do
    adapter().change_password(username, current_password, new_password, connection(server))
  end

  def known_user?(username, server \\ :default) do
    adapter().known_user?(username, connection(server))
  end

  def disable_user(username, reason, server \\ :default) do
    adapter().disable_user(username, reason, connection(server))
  end

  def enable_user(username, server \\ :default) do
    adapter().enable_user(username, connection(server))
  end

  def user_status(username, server \\ :default) do
    adapter().user_status(username, connection(server))
  end

  def count_users(server \\ :default) do
    adapter().count_users(connection(server))
  end

  def count_signups_since(seconds, server \\ :default) do
    adapter().count_signups_since(seconds, connection(server))
  end

  def metrics(server \\ :default) do
    adapter().metrics(connection(server))
  end

  def record_event(event, username, server \\ :default) do
    adapter().record_event(event, username, connection(server))
  end

  def reset(server \\ :default) do
    adapter().reset(connection(server))
  end

  def adapter do
    case RoomStore.store_mode() do
      :memory -> AuthStoreMemory
      :postgres -> AuthStorePostgres
    end
  end

  defp connection(:default), do: adapter()
  defp connection(server), do: server
end
