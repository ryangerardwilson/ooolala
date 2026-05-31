defmodule Ooolala.Auth do
  @moduledoc """
  Username/password auth for the open beta.

  New signups require a stronger password than the original seeded smoke-test
  accounts. Existing weak seeded credentials can still log in until changed.
  """

  alias Ooolala.AuthStore
  alias Ooolala.Version

  @password_min_length 12

  def authenticate(username, password) do
    with {:ok, username} <- normalize_username(username) do
      result = AuthStore.authenticate(username, to_string(password))
      record_auth_result(result, username)
      result
    else
      {:error, :invalid_username} ->
        AuthStore.record_event("login_failed", to_string(username))
        {:error, :invalid_credentials}
    end
  end

  def signup(username, password) do
    result =
      with {:ok, %{username: username}} <- signup_username(username),
           {:ok, password} <- normalize_password(password) do
        AuthStore.create_user(username, password)
      end

    case result do
      {:ok, %{username: username}} -> AuthStore.record_event("signup_created", username)
      _ -> AuthStore.record_event("signup_rejected", to_string(username))
    end

    result
  end

  def signup_username(username) do
    with {:ok, username} <- normalize_username(username) do
      if AuthStore.user_exists?(username) do
        {:error, :username_taken}
      else
        with :ok <- signup_open(),
             :ok <- signup_under_caps() do
          {:ok, %{username: username}}
        end
      end
    end
  end

  def change_password(username, current_password, new_password) do
    with {:ok, username} <- normalize_username(username),
         {:ok, new_password} <- normalize_password(new_password) do
      AuthStore.change_password(username, to_string(current_password), new_password)
    else
      {:error, :invalid_username} -> {:error, :invalid_credentials}
      error -> error
    end
  end

  def known_user?(username) do
    case normalize_username(username) do
      {:ok, username} -> AuthStore.known_user?(username)
      {:error, :invalid_username} -> false
    end
  end

  def dm_room(username, other_username) do
    with {:ok, username} <- normalize_username(username, :missing_user),
         {:ok, other_username} <- normalize_username(other_username, :missing_recipient),
         true <- username != other_username || {:error, :self_recipient},
         true <- known_user?(username) || {:error, :unknown_user},
         true <- known_user?(other_username) || {:error, :unknown_recipient} do
      room =
        [username, other_username]
        |> Enum.sort()
        |> Enum.join(":")

      {:ok, "dm:#{room}"}
    end
  end

  def signup_enabled? do
    case System.get_env("OOOLALA_OPEN_SIGNUP") do
      value when value in ["1", "true", "TRUE", "yes", "YES"] ->
        true

      value when value in ["0", "false", "FALSE", "no", "NO"] ->
        false

      _ ->
        Version.environment() in ["dev", "test", "local"]
    end
  end

  def password_min_length, do: @password_min_length

  defp signup_open do
    if signup_enabled?(), do: :ok, else: {:error, :signup_disabled}
  end

  defp signup_under_caps do
    with :ok <- user_cap_open(),
         :ok <- signup_window_open("OOOLALA_SIGNUP_HOURLY_LIMIT", 3_600),
         :ok <- signup_window_open("OOOLALA_SIGNUP_DAILY_LIMIT", 86_400) do
      :ok
    end
  end

  defp user_cap_open do
    case env_integer("OOOLALA_MAX_USERS") do
      nil ->
        :ok

      max_users ->
        if AuthStore.count_users() < max_users do
          :ok
        else
          {:error, :signup_limited}
        end
    end
  end

  defp signup_window_open(env_name, seconds) do
    case env_integer(env_name) do
      nil ->
        :ok

      limit ->
        if AuthStore.count_signups_since(seconds) < limit do
          :ok
        else
          {:error, :signup_limited}
        end
    end
  end

  defp normalize_username(value) do
    username =
      value
      |> to_string()
      |> String.trim()
      |> String.downcase()

    if Regex.match?(~r/^[a-z0-9_][a-z0-9_.-]{1,31}$/, username) do
      {:ok, username}
    else
      {:error, :invalid_username}
    end
  end

  defp normalize_username(value, reason) do
    case normalize_username(value) do
      {:ok, username} -> {:ok, username}
      {:error, :invalid_username} -> {:error, reason}
    end
  end

  defp normalize_password(value) do
    password = value |> to_string() |> String.trim()

    if String.length(password) >= @password_min_length do
      {:ok, password}
    else
      {:error, :invalid_password}
    end
  end

  defp record_auth_result({:ok, %{username: username}}, _fallback) do
    AuthStore.record_event("login_ok", username)
  end

  defp record_auth_result(_result, username) do
    AuthStore.record_event("login_failed", username)
  end

  defp env_integer(name) do
    case System.get_env(name) do
      nil ->
        nil

      value ->
        case Integer.parse(value) do
          {integer, ""} when integer > 0 -> integer
          _ -> nil
        end
    end
  end
end
