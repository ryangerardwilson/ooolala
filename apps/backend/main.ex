defmodule Ooolala.Application do
  @moduledoc "Backend process entrypoint."

  use Application

  @impl true
  def start(_type, _args) do
    children =
      [
        Ooolala.AuthStore,
        Ooolala.RoomStore
      ] ++ http_children()

    opts = [strategy: :one_for_one, name: Ooolala.Supervisor]
    Supervisor.start_link(children, opts)
  end

  defp http_children do
    if System.get_env("OOOLALA_BACKEND_HTTP") == "1" do
      [Ooolala.HttpServer]
    else
      []
    end
  end
end
