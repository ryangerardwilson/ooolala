defmodule Ooolala.Chat do
  @moduledoc "Pure chat-state operations used by terminal and backend surfaces."

  alias Ooolala.Message

  @default_max_body_bytes 2_048

  def new_state, do: %{}

  def send_message(state, room, author, body, attachments \\ []) when is_map(state) do
    room = clean(room)
    author = clean(author)
    body = String.trim(to_string(body))
    attachments = if is_list(attachments), do: attachments, else: []

    cond do
      room == "" ->
        {:error, :missing_room}

      author == "" ->
        {:error, :missing_author}

      body == "" and attachments == [] ->
        {:error, :missing_body}

      byte_size(body) > max_body_bytes() ->
        {:error, :body_too_large}

      true ->
        message = Message.new(room, author, body, attachments: attachments)
        next_state = Map.update(state, room, [message], &(&1 ++ [message]))
        {:ok, message, next_state}
    end
  end

  def list_messages(state, room, limit \\ :all) when is_map(state) do
    messages = Map.get(state, clean(room), [])

    case limit do
      :all -> messages
      n when is_integer(n) and n > 0 -> Enum.take(messages, -n)
      _ -> []
    end
  end

  def list_rooms(state) when is_map(state) do
    state
    |> Map.keys()
    |> Enum.sort()
  end

  defp clean(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.replace("\t", " ")
  end

  def max_body_bytes do
    case System.get_env("OOOLALA_MAX_MESSAGE_BYTES") do
      nil ->
        @default_max_body_bytes

      value ->
        case Integer.parse(value) do
          {integer, ""} when integer > 0 -> integer
          _ -> @default_max_body_bytes
        end
    end
  end
end
