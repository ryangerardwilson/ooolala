defmodule Ooolala.Attachment do
  @moduledoc "Validation and metadata helpers for message attachments."

  @default_max_count 5
  @default_max_bytes 5 * 1_024 * 1_024
  @default_max_total_bytes 15 * 1_024 * 1_024

  def prepare_uploads(nil), do: {:ok, []}

  def prepare_uploads(uploads) when is_list(uploads) do
    with :ok <- check_count(uploads),
         {:ok, prepared} <- prepare_each(uploads),
         :ok <- check_total(prepared) do
      {:ok, prepared}
    end
  end

  def prepare_uploads(_uploads), do: {:error, :invalid_attachment}

  def metadata(upload) do
    %{
      id: upload.id,
      filename: upload.filename,
      content_type: upload.content_type,
      byte_size: upload.byte_size
    }
  end

  def metadata_list(uploads), do: Enum.map(uploads, &metadata/1)

  def download_path(message_id, attachment) do
    "/attachments/#{URI.encode_www_form(to_string(message_id))}/#{URI.encode_www_form(attachment.id)}"
  end

  def max_count, do: env_integer("OOOLALA_MAX_ATTACHMENTS", @default_max_count)
  def max_bytes, do: env_integer("OOOLALA_MAX_ATTACHMENT_BYTES", @default_max_bytes)

  def max_total_bytes do
    env_integer("OOOLALA_MAX_ATTACHMENTS_TOTAL_BYTES", @default_max_total_bytes)
  end

  defp prepare_each(uploads) do
    uploads
    |> Enum.reduce_while({:ok, []}, fn upload, {:ok, prepared} ->
      case prepare_one(upload) do
        {:ok, next_upload} -> {:cont, {:ok, [next_upload | prepared]}}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
    |> case do
      {:ok, prepared} -> {:ok, Enum.reverse(prepared)}
      error -> error
    end
  end

  defp prepare_one(%{filename: filename, content_type: content_type, data: data})
       when is_binary(data) do
    filename = safe_filename(filename)
    content_type = safe_content_type(content_type)
    byte_size = byte_size(data)

    cond do
      filename == "" ->
        {:error, :invalid_attachment}

      byte_size == 0 ->
        {:error, :invalid_attachment}

      byte_size > max_bytes() ->
        {:error, :attachment_too_large}

      true ->
        {:ok,
         %{
           id: random_id(),
           filename: filename,
           content_type: content_type,
           byte_size: byte_size,
           data: data
         }}
    end
  end

  defp prepare_one(_upload), do: {:error, :invalid_attachment}

  defp check_count(uploads) do
    if length(uploads) <= max_count() do
      :ok
    else
      {:error, :too_many_attachments}
    end
  end

  defp check_total(uploads) do
    total = uploads |> Enum.map(& &1.byte_size) |> Enum.sum()

    if total <= max_total_bytes() do
      :ok
    else
      {:error, :attachments_too_large}
    end
  end

  defp safe_filename(value) do
    value
    |> to_string()
    |> String.trim()
    |> String.replace("\\", "/")
    |> String.split("/", trim: true)
    |> List.last()
    |> to_string()
    |> String.replace(~r/[\x00-\x1F\x7F]/, "")
    |> String.slice(0, 180)
  end

  defp safe_content_type(value) do
    value = value |> to_string() |> String.trim() |> String.downcase()

    if Regex.match?(~r/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/, value) do
      value
    else
      "application/octet-stream"
    end
  end

  defp random_id do
    8
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
  end

  defp env_integer(name, fallback) do
    case System.get_env(name) do
      nil ->
        fallback

      value ->
        case Integer.parse(value) do
          {integer, ""} when integer > 0 -> integer
          _ -> fallback
        end
    end
  end
end
