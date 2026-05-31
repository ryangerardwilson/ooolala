defmodule Mix.Tasks.Ooolala.Db.Migrate do
  @moduledoc "Runs the Ooolala Postgres migrations."
  @shortdoc "Runs Ooolala Postgres migrations"

  use Mix.Task

  @requirements ["app.start"]

  @impl true
  def run(_args) do
    Ooolala.Migrations.run()
    Mix.shell().info("ooolala database migrated")
  end
end
