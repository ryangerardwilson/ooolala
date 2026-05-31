defmodule Ooolala.Message do
  @moduledoc "Shared message shape for CLI, backend, TUI, and web projections."

  @enforce_keys [:id, :room, :author, :body, :inserted_at]
  defstruct [:id, :room, :author, :body, :inserted_at, attachments: []]

  def new(room, author, body, opts \\ []) do
    inserted_at =
      opts
      |> Keyword.get(:inserted_at, DateTime.utc_now())
      |> DateTime.truncate(:second)

    %__MODULE__{
      id: Keyword.get(opts, :id, build_id(inserted_at)),
      room: clean(room),
      author: clean(author),
      body: String.trim(to_string(body)),
      inserted_at: inserted_at,
      attachments: Keyword.get(opts, :attachments, [])
    }
  end

  defp build_id(inserted_at) do
    stamp = Calendar.strftime(inserted_at, "%Y%m%d%H%M%S")
    unique = Base.url_encode64(:crypto.strong_rand_bytes(8), padding: false)
    "#{stamp}-#{unique}"
  end

  defp clean(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.replace("\t", " ")
  end
end
