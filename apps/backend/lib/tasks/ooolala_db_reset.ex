defmodule Mix.Tasks.Ooolala.Db.Reset do
  @moduledoc "Truncates local message data after running migrations."
  @shortdoc "Resets Ooolala message data"

  use Mix.Task

  @requirements ["app.start"]

  @impl true
  def run(_args) do
    Ooolala.Migrations.run()
    Ooolala.RoomStore.reset()
    Mix.shell().info("ooolala database reset")
  end
end
