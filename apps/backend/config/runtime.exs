import Config

store_default = if config_env() == :test, do: "memory", else: "postgres"

config :ooolala,
  store: System.get_env("OOOLALA_STORE", store_default),
  database_url: System.get_env("DATABASE_URL")
