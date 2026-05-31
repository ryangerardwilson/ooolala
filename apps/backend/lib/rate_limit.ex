defmodule Ooolala.RateLimit do
  @moduledoc "Small backend rate limits for the open-signup beta."

  alias Ooolala.RoomStore

  @default_message_count 30
  @default_message_window_seconds 60

  def check_message(username) do
    count = env_integer("OOOLALA_MESSAGE_RATE_LIMIT_COUNT", @default_message_count)

    seconds =
      env_integer("OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS", @default_message_window_seconds)

    if RoomStore.count_recent_messages_by_author(username, seconds) < count do
      :ok
    else
      {:error, :rate_limited}
    end
  end

  defp env_integer(name, fallback) do
    case System.get_env(name) do
      nil ->
        fallback

      value ->
        case Integer.parse(value) do
          {integer, ""} when integer > 0 -> integer
          _ -> fallback
        end
    end
  end
end
