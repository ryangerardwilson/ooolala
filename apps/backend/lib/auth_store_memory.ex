defmodule Ooolala.AuthStoreMemory do
  @moduledoc "In-memory credential store for tests and throwaway development."

  use GenServer

  alias Ooolala.AuthStore
  alias Ooolala.Password

  def start_link(opts \\ []) do
    name = Keyword.get(opts, :name, __MODULE__)
    GenServer.start_link(__MODULE__, seed_state(), name: name)
  end

  def create_user(username, password, server \\ __MODULE__) do
    GenServer.call(server, {:create_user, username, password})
  end

  def authenticate(username, password, server \\ __MODULE__) do
    GenServer.call(server, {:authenticate, username, password})
  end

  def user_exists?(username, server \\ __MODULE__) do
    GenServer.call(server, {:user_exists?, username})
  end

  def change_password(username, current_password, new_password, server \\ __MODULE__) do
    GenServer.call(server, {:change_password, username, current_password, new_password})
  end

  def known_user?(username, server \\ __MODULE__) do
    GenServer.call(server, {:known_user?, username})
  end

  def disable_user(username, reason, server \\ __MODULE__) do
    GenServer.call(server, {:disable_user, username, reason})
  end

  def enable_user(username, server \\ __MODULE__) do
    GenServer.call(server, {:enable_user, username})
  end

  def user_status(username, server \\ __MODULE__) do
    GenServer.call(server, {:user_status, username})
  end

  def count_users(server \\ __MODULE__) do
    GenServer.call(server, :count_users)
  end

  def count_signups_since(seconds, server \\ __MODULE__) do
    GenServer.call(server, {:count_signups_since, seconds})
  end

  def metrics(server \\ __MODULE__) do
    GenServer.call(server, :metrics)
  end

  def record_event(event, username, server \\ __MODULE__) do
    GenServer.call(server, {:record_event, event, username})
  end

  def reset(server \\ __MODULE__) do
    GenServer.call(server, :reset)
  end

  def init(state), do: {:ok, state}

  def handle_call({:create_user, username, password}, _from, state) do
    if Map.has_key?(state.users, username) do
      {:reply, {:error, :username_taken}, state}
    else
      next_state =
        put_in(state.users[username], %{
          password_hash: Password.hash(password),
          inserted_at: DateTime.utc_now(),
          updated_at: DateTime.utc_now(),
          last_login_at: nil,
          disabled_at: nil,
          disabled_reason: nil
        })

      {:reply, {:ok, %{username: username}}, next_state}
    end
  end

  def handle_call({:authenticate, username, password}, _from, state) do
    case Map.fetch(state.users, username) do
      {:ok, %{disabled_at: nil, password_hash: hash} = user} ->
        if Password.verify(password, hash) do
          next_state = put_in(state.users[username], %{user | last_login_at: DateTime.utc_now()})
          {:reply, {:ok, %{username: username}}, next_state}
        else
          {:reply, {:error, :invalid_credentials}, state}
        end

      _ ->
        {:reply, {:error, :invalid_credentials}, state}
    end
  end

  def handle_call({:change_password, username, current_password, new_password}, _from, state) do
    case Map.fetch(state.users, username) do
      {:ok, %{disabled_at: nil, password_hash: hash} = user} ->
        if Password.verify(current_password, hash) do
          next_state =
            put_in(state.users[username], %{
              user
              | password_hash: Password.hash(new_password),
                updated_at: DateTime.utc_now()
            })

          {:reply, {:ok, %{username: username}}, next_state}
        else
          {:reply, {:error, :invalid_credentials}, state}
        end

      :error ->
        {:reply, {:error, :invalid_credentials}, state}
    end
  end

  def handle_call({:user_exists?, username}, _from, state) do
    {:reply, Map.has_key?(state.users, username), state}
  end

  def handle_call({:known_user?, username}, _from, state) do
    known =
      case Map.fetch(state.users, username) do
        {:ok, %{disabled_at: nil}} -> true
        _ -> false
      end

    {:reply, known, state}
  end

  def handle_call({:disable_user, username, reason}, _from, state) do
    case Map.fetch(state.users, username) do
      {:ok, user} ->
        next_state =
          put_in(state.users[username], %{
            user
            | disabled_at: DateTime.utc_now(),
              disabled_reason: to_string(reason)
          })

        {:reply, {:ok, %{username: username}}, next_state}

      :error ->
        {:reply, {:error, :unknown_user}, state}
    end
  end

  def handle_call({:enable_user, username}, _from, state) do
    case Map.fetch(state.users, username) do
      {:ok, user} ->
        next_state =
          put_in(state.users[username], %{user | disabled_at: nil, disabled_reason: nil})

        {:reply, {:ok, %{username: username}}, next_state}

      :error ->
        {:reply, {:error, :unknown_user}, state}
    end
  end

  def handle_call({:user_status, username}, _from, state) do
    reply =
      case Map.fetch(state.users, username) do
        {:ok, user} ->
          {:ok,
           %{
             username: username,
             disabled_at: user.disabled_at,
             disabled_reason: user.disabled_reason,
             last_login_at: user.last_login_at,
             inserted_at: user.inserted_at
           }}

        :error ->
          {:error, :unknown_user}
      end

    {:reply, reply, state}
  end

  def handle_call(:count_users, _from, state) do
    {:reply, map_size(state.users), state}
  end

  def handle_call({:count_signups_since, seconds}, _from, state) do
    cutoff = DateTime.add(DateTime.utc_now(), -seconds, :second)

    count =
      Enum.count(state.users, fn {_username, user} ->
        DateTime.compare(user.inserted_at, cutoff) in [:gt, :eq]
      end)

    {:reply, count, state}
  end

  def handle_call(:metrics, _from, state) do
    now = DateTime.utc_now()
    day_cutoff = DateTime.add(now, -86_400, :second)
    week_cutoff = DateTime.add(now, -604_800, :second)

    users = Map.values(state.users)

    metrics = %{
      users_total: length(users),
      users_created_24h: count_since(users, :inserted_at, day_cutoff),
      users_created_7d: count_since(users, :inserted_at, week_cutoff),
      disabled_users: Enum.count(users, & &1.disabled_at),
      login_failed_24h: event_count(state.events, "login_failed", day_cutoff),
      signup_created_24h: event_count(state.events, "signup_created", day_cutoff),
      signup_rejected_24h: event_count(state.events, "signup_rejected", day_cutoff)
    }

    {:reply, metrics, state}
  end

  def handle_call({:record_event, event, username}, _from, state) do
    event = %{
      event: to_string(event),
      username: to_string(username),
      inserted_at: DateTime.utc_now()
    }

    {:reply, :ok, update_in(state.events, &[event | &1])}
  end

  def handle_call(:reset, _from, _state) do
    {:reply, :ok, seed_state()}
  end

  defp seed_state do
    now = DateTime.utc_now()

    users =
      AuthStore.seed_users()
      |> Map.new(fn {username, password} ->
        {username,
         %{
           password_hash: Password.hash(password),
           inserted_at: now,
           updated_at: now,
           last_login_at: nil,
           disabled_at: nil,
           disabled_reason: nil
         }}
      end)

    %{users: users, events: []}
  end

  defp count_since(users, field, cutoff) do
    Enum.count(users, fn user ->
      value = Map.fetch!(user, field)
      value && DateTime.compare(value, cutoff) in [:gt, :eq]
    end)
  end

  defp event_count(events, event, cutoff) do
    Enum.count(events, fn value ->
      value.event == event && DateTime.compare(value.inserted_at, cutoff) in [:gt, :eq]
    end)
  end
end
