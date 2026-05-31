defmodule Ooolala.Admin do
  @moduledoc "Operator-only helpers for the open-signup beta."

  alias Ooolala.AuthStore
  alias Ooolala.RoomStore

  def disable_user(username, reason \\ "operator disabled") do
    AuthStore.disable_user(clean(username), clean(reason))
  end

  def enable_user(username) do
    AuthStore.enable_user(clean(username))
  end

  def user_status(username) do
    AuthStore.user_status(clean(username))
  end

  def metrics do
    Map.merge(AuthStore.metrics(), RoomStore.metrics())
  end

  defp clean(value) do
    value
    |> to_string()
    |> String.trim()
  end
end
