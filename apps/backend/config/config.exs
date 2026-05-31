import Config

config :ooolala,
  store: if(config_env() == :test, do: "memory", else: "postgres")
