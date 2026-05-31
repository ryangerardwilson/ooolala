defmodule Ooolala.Version do
  @moduledoc "Shared product and compatibility contract versions."

  @product_version Mix.Project.config()[:version]
  @cli_contract 8
  @chat_protocol_min 1
  @chat_protocol_max 3
  @db_schema 7
  @auth_policy 7
  @ui_flow 12
  @compile_env Mix.env() |> to_string()

  def product_version, do: @product_version
  def cli_contract, do: @cli_contract
  def chat_protocol_min, do: @chat_protocol_min
  def chat_protocol_max, do: @chat_protocol_max
  def db_schema, do: @db_schema
  def auth_policy, do: @auth_policy
  def ui_flow, do: @ui_flow

  def environment do
    System.get_env("OOOLALA_ENV") ||
      System.get_env("MIX_ENV") ||
      @compile_env
  end

  def commit do
    System.get_env("OOOLALA_COMMIT") ||
      System.get_env("GITHUB_SHA") ||
      "local"
  end

  def local_lines do
    [
      "product_version #{product_version()}",
      "commit #{commit()}",
      "environment #{environment()}",
      "cli_contract #{cli_contract()}",
      "chat_protocol #{chat_protocol_min()}..#{chat_protocol_max()}",
      "auth_policy #{auth_policy()}",
      "ui_flow #{ui_flow()}"
    ]
  end
end
