defmodule Ooolala.RoomStoreMemory do
  @moduledoc "In-memory room store for tests and explicit throwaway development."

  use GenServer

  alias Ooolala.Attachment
  alias Ooolala.Chat

  defp new_state, do: %{messages: Chat.new_state(), dm_chats: %{}, attachments: %{}}

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, new_state(), name: name)
  end

  def send_message(room, author, body, server \\ __MODULE__) do
    send_message_with_attachments(room, author, body, [], server)
  end

  def send_message_with_attachments(room, author, body, uploads, server \\ __MODULE__) do
    GenServer.call(server, {:send_message, room, author, body, uploads})
  end

  def list_messages(room, limit \\ :all, server \\ __MODULE__) do
    GenServer.call(server, {:list_messages, room, limit})
  end

  def list_rooms(server \\ __MODULE__) do
    GenServer.call(server, :list_rooms)
  end

  def ensure_dm_chat(username, peer, room, server \\ __MODULE__) do
    GenServer.call(server, {:ensure_dm_chat, username, peer, room})
  end

  def remove_dm_chat(username, peer, room, server \\ __MODULE__) do
    GenServer.call(server, {:remove_dm_chat, username, peer, room})
  end

  def list_dm_peers(username, server \\ __MODULE__) do
    GenServer.call(server, {:list_dm_peers, username})
  end

  def attachment(message_id, attachment_id, server \\ __MODULE__) do
    GenServer.call(server, {:attachment, message_id, attachment_id})
  end

  def count_recent_messages_by_author(author, seconds, server \\ __MODULE__) do
    GenServer.call(server, {:count_recent_messages_by_author, author, seconds})
  end

  def metrics(server \\ __MODULE__) do
    GenServer.call(server, :metrics)
  end

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  def health(_server \\ __MODULE__), do: :ok

  def schema_version(_server \\ __MODULE__), do: 0

  @impl true
  def init(state), do: {:ok, state}

  @impl true
  def handle_call({:send_message, room, author, body, uploads}, _from, state) do
    metadata = Attachment.metadata_list(uploads)

    case Chat.send_message(state.messages, room, author, body, metadata) do
      {:ok, message, next_messages} ->
        attachment_rows =
          Enum.map(uploads, fn upload ->
            Map.merge(upload, %{message_id: message.id, room: message.room})
          end)

        next_attachments =
          if attachment_rows == [] do
            state.attachments
          else
            Map.put(state.attachments, message.id, attachment_rows)
          end

        {:reply, {:ok, message},
         %{state | messages: next_messages, attachments: next_attachments}}

      {:error, reason} ->
        {:reply, {:error, reason}, state}
    end
  end

  def handle_call({:list_messages, room, limit}, _from, state) do
    {:reply, Chat.list_messages(state.messages, room, limit), state}
  end

  def handle_call(:list_rooms, _from, state) do
    {:reply, Chat.list_rooms(state.messages), state}
  end

  def handle_call({:ensure_dm_chat, username, peer, _room}, _from, state) do
    username = clean(username)
    peer = clean(peer)
    chats = Map.update(state.dm_chats, username, MapSet.new([peer]), &MapSet.put(&1, peer))

    {:reply, :ok, %{state | dm_chats: chats}}
  end

  def handle_call({:remove_dm_chat, username, peer, _room}, _from, state) do
    username = clean(username)
    peer = clean(peer)
    chats = Map.update(state.dm_chats, username, MapSet.new(), &MapSet.delete(&1, peer))

    {:reply, :ok, %{state | dm_chats: chats}}
  end

  def handle_call({:list_dm_peers, username}, _from, state) do
    peers =
      state.dm_chats
      |> Map.get(clean(username), MapSet.new())
      |> MapSet.to_list()
      |> Enum.sort()

    {:reply, peers, state}
  end

  def handle_call({:attachment, message_id, attachment_id}, _from, state) do
    result =
      state.attachments
      |> Map.get(to_string(message_id), [])
      |> Enum.find(&(&1.id == to_string(attachment_id)))
      |> case do
        nil -> {:error, :attachment_not_found}
        attachment -> {:ok, attachment}
      end

    {:reply, result, state}
  end

  def handle_call({:count_recent_messages_by_author, author, seconds}, _from, state) do
    cutoff = DateTime.add(DateTime.utc_now(), -seconds, :second)

    count =
      state.messages
      |> Map.values()
      |> List.flatten()
      |> Enum.count(fn message ->
        message.author == author && DateTime.compare(message.inserted_at, cutoff) in [:gt, :eq]
      end)

    {:reply, count, state}
  end

  def handle_call(:metrics, _from, state) do
    now = DateTime.utc_now()
    day_cutoff = DateTime.add(now, -86_400, :second)
    week_cutoff = DateTime.add(now, -604_800, :second)
    messages = state.messages |> Map.values() |> List.flatten()

    metrics = %{
      messages_total: length(messages),
      messages_24h: count_messages_since(messages, day_cutoff),
      messages_7d: count_messages_since(messages, week_cutoff),
      unique_senders_24h: unique_senders_since(messages, day_cutoff),
      unique_senders_7d: unique_senders_since(messages, week_cutoff),
      top_senders_24h: top_senders_since(messages, day_cutoff)
    }

    {:reply, metrics, state}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, new_state()}
  end

  defp clean(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.replace("\t", " ")
  end

  defp count_messages_since(messages, cutoff) do
    Enum.count(messages, &(DateTime.compare(&1.inserted_at, cutoff) in [:gt, :eq]))
  end

  defp unique_senders_since(messages, cutoff) do
    messages
    |> Enum.filter(&(DateTime.compare(&1.inserted_at, cutoff) in [:gt, :eq]))
    |> Enum.map(& &1.author)
    |> Enum.uniq()
    |> length()
  end

  defp top_senders_since(messages, cutoff) do
    messages
    |> Enum.filter(&(DateTime.compare(&1.inserted_at, cutoff) in [:gt, :eq]))
    |> Enum.frequencies_by(& &1.author)
    |> Enum.sort_by(fn {_author, count} -> -count end)
    |> Enum.take(10)
  end
end
