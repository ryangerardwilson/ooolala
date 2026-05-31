defmodule Ooolala.MixProject do
  use Mix.Project

  def project do
    [
      app: :ooolala,
      version: version(),
      elixir: "~> 1.19",
      elixirc_paths: elixirc_paths(),
      start_permanent: Mix.env() == :prod,
      deps: deps(),
      releases: [
        backend: [
          applications: [
            ooolala: :permanent
          ]
        ]
      ]
    ]
  end

  def application do
    [
      extra_applications: [:crypto, :logger],
      mod: {Ooolala.Application, []}
    ]
  end

  defp deps do
    []
  end

  defp elixirc_paths do
    ["main.ex"] ++ Path.wildcard("lib/**/*.ex")
  end

  def version do
    __DIR__
    |> Path.join("../../VERSION")
    |> Path.expand()
    |> File.read!()
    |> String.trim()
  end
end
