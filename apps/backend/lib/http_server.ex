defmodule Ooolala.HttpServer do
  @moduledoc "Small OTP HTTP edge for health checks, auth, and DM smoke tests."

  use GenServer

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  @impl true
  def init(_opts) do
    port =
      System.get_env("PORT", "4000")
      |> String.to_integer()

    {:ok, socket} =
      :gen_tcp.listen(port, [
        :binary,
        active: false,
        packet: :raw,
        reuseaddr: true
      ])

    task = Task.async(fn -> accept_loop(socket) end)
    {:ok, %{socket: socket, task: task}}
  end

  @impl true
  def terminate(_reason, %{socket: socket}) do
    :gen_tcp.close(socket)
    :ok
  end

  defp accept_loop(socket) do
    case :gen_tcp.accept(socket) do
      {:ok, client} ->
        Task.start(fn -> handle_client(client) end)
        accept_loop(socket)

      {:error, :closed} ->
        :ok
    end
  end

  defp handle_client(client) do
    case read_request(client) do
      {:ok, request} -> :gen_tcp.send(client, response_for(request))
      {:error, _reason} -> :ok
    end

    :gen_tcp.close(client)
  end

  defp read_request(client, acc \\ "") do
    case :gen_tcp.recv(client, 0, 5_000) do
      {:ok, chunk} ->
        next = acc <> chunk

        if request_complete?(next) do
          {:ok, next}
        else
          read_request(client, next)
        end

      error ->
        error
    end
  end

  defp request_complete?(request) do
    case String.split(request, "\r\n\r\n", parts: 2) do
      [head, body] ->
        content_length =
          head
          |> String.split("\r\n")
          |> parse_headers()
          |> Map.get("content-length", "0")
          |> parse_content_length()

        byte_size(body) >= content_length

      _ ->
        false
    end
  end

  defp response_for(request) do
    case parse_request(request) do
      {:ok, parsed} -> route(parsed)
      :error -> response(400, "text/plain", "bad request\n")
    end
  end

  defp route(%{method: "OPTIONS"}), do: response(204, "text/plain", "")

  defp route(%{method: "GET", path: "/health"}) do
    case Ooolala.health() do
      :ok -> response(200, "text/plain", "ok")
      {:error, _reason} -> response(503, "text/plain", "unhealthy\n")
    end
  end

  defp route(%{method: "GET", path: "/version", query: query}) do
    params = URI.decode_query(query || "")

    if Map.get(params, "format") == "text" do
      response(200, "text/plain", Enum.join(Ooolala.version_lines(), "\n") <> "\n")
    else
      response(200, "application/json", version_json(Ooolala.version_vector()) <> "\n")
    end
  end

  defp route(%{method: "POST", path: "/login", body: body}) do
    params = URI.decode_query(body)

    case Ooolala.login(Map.get(params, "username", ""), Map.get(params, "password", "")) do
      {:ok, %{username: username}} -> response(200, "text/plain", "ok #{username}\n")
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "GET", path: "/signup", query: query}) do
    params = URI.decode_query(query || "")

    case Ooolala.signup_username(Map.get(params, "username", "")) do
      {:ok, %{username: username}} ->
        response(200, "text/plain", "ok #{username}\n")

      {:error, :signup_disabled} ->
        response(403, "text/plain", "signup disabled\n")

      {:error, :signup_limited} ->
        response(429, "text/plain", "signup temporarily limited\n")

      {:error, :invalid_username} ->
        response(400, "text/plain", "invalid username\n")

      {:error, :username_taken} ->
        response(409, "text/plain", "username unavailable\n")
    end
  end

  defp route(%{method: "POST", path: "/signup", body: body}) do
    params = URI.decode_query(body)

    case Ooolala.signup(Map.get(params, "username", ""), Map.get(params, "password", "")) do
      {:ok, %{username: username}} ->
        response(201, "text/plain", "ok #{username}\n")

      {:error, :signup_disabled} ->
        response(403, "text/plain", "signup disabled\n")

      {:error, :signup_limited} ->
        response(429, "text/plain", "signup temporarily limited\n")

      {:error, :invalid_username} ->
        response(400, "text/plain", "invalid username\n")

      {:error, :invalid_password} ->
        response(400, "text/plain", password_error())

      {:error, :username_taken} ->
        response(409, "text/plain", "username unavailable\n")
    end
  end

  defp route(%{method: "POST", path: "/password", body: body} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         params <- URI.decode_query(body),
         {:ok, new_password} <- require_param(params, "password"),
         {:ok, encoded} <- basic_credentials(Map.get(request.headers, "authorization", "")),
         {:ok, decoded} <- Base.decode64(encoded),
         [_username, current_password] <- String.split(decoded, ":", parts: 2),
         {:ok, _user} <- Ooolala.change_password(username, current_password, new_password) do
      response(200, "text/plain", "ok #{username}\n")
    else
      {:error, :invalid_credentials} ->
        response(401, "text/plain", "invalid credentials\n")

      {:error, :missing_password} ->
        response(400, "text/plain", "password required\n")

      {:error, :invalid_password} ->
        response(400, "text/plain", password_error())

      _ ->
        response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "GET", path: "/dm/peers", query: query} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request) do
      params = URI.decode_query(query || "")
      peers = Ooolala.dm_peers(username)

      case response_format(params) do
        :json -> response(200, "application/json", peers_json(peers) <> "\n")
        _ -> response(200, "text/plain", format_peer_list(peers))
      end
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "POST", path: "/dm/chats", body: body} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         params <- URI.decode_query(body),
         {:ok, peer} <- require_param(params, "with"),
         {:ok, chat} <- Ooolala.start_dm(username, peer) do
      case response_format(params) do
        :json -> response(200, "application/json", chat_json(chat) <> "\n")
        _ -> response(200, "text/plain", "ok #{chat.peer}\n")
      end
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
      {:error, :missing_recipient} -> response(400, "text/plain", "recipient required\n")
      {:error, :self_recipient} -> response(400, "text/plain", "cannot dm yourself\n")
      {:error, :unknown_recipient} -> response(404, "text/plain", "unknown user\n")
      {:error, :missing_user} -> response(400, "text/plain", "user required\n")
      {:error, :unknown_user} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "DELETE", path: "/dm/chats", query: query} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         params <- URI.decode_query(query || ""),
         {:ok, peer} <- require_param(params, "with"),
         :ok <- Ooolala.remove_dm(username, peer) do
      response(200, "text/plain", "removed #{peer}\n")
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
      {:error, :missing_recipient} -> response(400, "text/plain", "recipient required\n")
      {:error, :self_recipient} -> response(400, "text/plain", "cannot dm yourself\n")
      {:error, :unknown_recipient} -> response(404, "text/plain", "unknown user\n")
      {:error, :missing_user} -> response(400, "text/plain", "user required\n")
      {:error, :unknown_user} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "POST", path: "/dm", body: body} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         params <- URI.decode_query(body),
         {:ok, to} <- require_param(params, "to"),
         {:ok, uploads} <- parse_attachments(params),
         {:ok, message_body} <- message_body_param(params, uploads),
         {:ok, message} <- Ooolala.send_dm(username, to, message_body, uploads) do
      format = response_format(params)
      response(200, content_type(format), format_message(message, format))
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
      {:error, :missing_body} -> response(400, "text/plain", "message body required\n")
      {:error, :body_too_large} -> response(413, "text/plain", "message body too large\n")
      {:error, :invalid_attachment} -> response(400, "text/plain", "invalid attachment\n")
      {:error, :too_many_attachments} -> response(413, "text/plain", "too many attachments\n")
      {:error, :attachment_too_large} -> response(413, "text/plain", "attachment too large\n")
      {:error, :attachments_too_large} -> response(413, "text/plain", "attachments too large\n")
      {:error, :rate_limited} -> response(429, "text/plain", "rate limited\n")
      {:error, :missing_recipient} -> response(400, "text/plain", "recipient required\n")
      {:error, :self_recipient} -> response(400, "text/plain", "cannot dm yourself\n")
      {:error, :unknown_recipient} -> response(404, "text/plain", "unknown user\n")
      {:error, :missing_user} -> response(400, "text/plain", "user required\n")
      {:error, :unknown_user} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "GET", path: "/dm", query: query} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         params <- URI.decode_query(query || ""),
         {:ok, other_username} <- require_param(params, "with"),
         {:ok, messages} <- Ooolala.dm_messages(username, other_username, 50) do
      format = response_format(params)
      response(200, content_type(format), format_messages(messages, format))
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
      {:error, :missing_recipient} -> response(400, "text/plain", "recipient required\n")
      {:error, :self_recipient} -> response(400, "text/plain", "cannot dm yourself\n")
      {:error, :unknown_recipient} -> response(404, "text/plain", "unknown user\n")
      {:error, :missing_user} -> response(400, "text/plain", "user required\n")
      {:error, :unknown_user} -> response(401, "text/plain", "invalid credentials\n")
    end
  end

  defp route(%{method: "GET", path: "/attachments/" <> rest} = request) do
    with {:ok, %{username: username}} <- authenticated_user(request),
         [message_id, attachment_id | _rest] <- String.split(rest, "/", trim: true),
         {:ok, attachment} <-
           Ooolala.attachment(username, URI.decode(message_id), URI.decode(attachment_id)) do
      response(200, attachment.content_type, attachment.data, [
        {"content-disposition",
         "attachment; filename=\"#{header_filename(attachment.filename)}\""}
      ])
    else
      {:error, :invalid_credentials} -> response(401, "text/plain", "invalid credentials\n")
      _ -> response(404, "text/plain", "attachment not found\n")
    end
  end

  defp route(_request), do: response(404, "text/plain", "not found\n")

  defp parse_request(request) do
    case String.split(request, "\r\n\r\n", parts: 2) do
      [head, body] -> parse_head(head, body)
      [head] -> parse_head(head, "")
      _ -> :error
    end
  end

  defp parse_head(head, body) do
    case String.split(head, "\r\n") do
      [request_line | header_lines] ->
        with [method, target, _version] <- String.split(request_line, " ", parts: 3),
             %URI{path: path, query: query} <- URI.parse(target) do
          {:ok,
           %{
             method: method,
             path: path || "/",
             query: query,
             headers: parse_headers(header_lines),
             body: body
           }}
        else
          _ -> :error
        end

      _ ->
        :error
    end
  end

  defp parse_headers(lines) do
    lines
    |> Enum.flat_map(fn line ->
      case String.split(line, ":", parts: 2) do
        [key, value] -> [{String.downcase(String.trim(key)), String.trim(value)}]
        _ -> []
      end
    end)
    |> Map.new()
  end

  defp authenticated_user(%{headers: headers}) do
    with {:ok, encoded} <- basic_credentials(Map.get(headers, "authorization", "")),
         {:ok, decoded} <- Base.decode64(encoded),
         [username, password] <- String.split(decoded, ":", parts: 2),
         {:ok, user} <- Ooolala.login(username, password) do
      {:ok, user}
    else
      _ -> {:error, :invalid_credentials}
    end
  end

  defp basic_credentials(value) do
    case String.split(value, " ", parts: 2) do
      [scheme, encoded] ->
        if String.downcase(scheme) == "basic" do
          {:ok, String.trim(encoded)}
        else
          {:error, :invalid_credentials}
        end

      _ ->
        {:error, :invalid_credentials}
    end
  end

  defp require_param(params, "to") do
    params
    |> Map.get("to", "")
    |> required(:missing_recipient)
  end

  defp require_param(params, "with") do
    params
    |> Map.get("with", "")
    |> required(:missing_recipient)
  end

  defp require_param(params, "body") do
    params
    |> Map.get("body", "")
    |> required(:missing_body)
  end

  defp require_param(params, "password") do
    params
    |> Map.get("password", "")
    |> required(:missing_password)
  end

  defp message_body_param(params, uploads) do
    body = params |> Map.get("body", "") |> to_string() |> String.trim()

    if body == "" and uploads == [] do
      {:error, :missing_body}
    else
      {:ok, body}
    end
  end

  defp parse_attachments(params) do
    count =
      params
      |> Map.get("attachment_count", "0")
      |> parse_content_length()

    cond do
      count == 0 ->
        {:ok, []}

      count < 0 ->
        {:error, :invalid_attachment}

      true ->
        uploads =
          0..(count - 1)
          |> Enum.map(fn index ->
            data = Map.get(params, "attachment_#{index}_data", "")

            %{
              filename: Map.get(params, "attachment_#{index}_filename", ""),
              content_type: Map.get(params, "attachment_#{index}_content_type", ""),
              data: Base.decode64(data)
            }
          end)

        uploads
        |> Enum.reduce_while({:ok, []}, fn upload, {:ok, parsed} ->
          case upload.data do
            {:ok, data} -> {:cont, {:ok, [%{upload | data: data} | parsed]}}
            _ -> {:halt, {:error, :invalid_attachment}}
          end
        end)
        |> case do
          {:ok, parsed} -> {:ok, Enum.reverse(parsed)}
          error -> error
        end
    end
  end

  defp required(value, reason) do
    value = String.trim(to_string(value))

    if value == "" do
      {:error, reason}
    else
      {:ok, value}
    end
  end

  defp response_format(params) do
    case Map.get(params, "format") do
      "json" -> :json
      "iso" -> :iso
      _ -> :legacy
    end
  end

  defp parse_content_length(value) do
    case Integer.parse(to_string(value)) do
      {integer, ""} -> integer
      _ -> 0
    end
  end

  defp content_type(:json), do: "application/json"
  defp content_type(_format), do: "text/plain"

  defp format_messages([], :json), do: "{\"messages\":[]}\n"
  defp format_messages([], _format), do: "no messages\n"

  defp format_messages(messages, :json) do
    "{\"messages\":[" <>
      (messages |> Enum.map(&message_json/1) |> Enum.join(",")) <> "]}\n"
  end

  defp format_messages(messages, format) do
    messages
    |> Enum.map(&format_message(&1, format))
    |> Enum.join("")
  end

  defp format_peer_list([]), do: ""
  defp format_peer_list(peers), do: Enum.join(peers, "\n") <> "\n"

  defp format_message(message, :legacy) do
    time = Calendar.strftime(message.inserted_at, "%H:%M:%S")
    "#{time} #{message.room} #{message.author}: #{message.body}#{legacy_attachments(message)}\n"
  end

  defp format_message(message, :iso) do
    timestamp = DateTime.to_iso8601(message.inserted_at)

    "#{timestamp} #{message.room} #{message.author}: #{message.body}#{legacy_attachments(message)}\n"
  end

  defp format_message(message, :json), do: "{\"message\":#{message_json(message)}}\n"

  defp message_json(message) do
    attachments_json =
      message.attachments
      |> Enum.map(&attachment_json(message, &1))
      |> Enum.join(",")

    """
    {"id":#{json_string(message.id)},"room":#{json_string(message.room)},"author":#{json_string(message.author)},"body":#{json_string(message.body)},"inserted_at":#{json_string(DateTime.to_iso8601(message.inserted_at))},"attachments":[#{attachments_json}]}
    """
    |> String.trim()
  end

  defp attachment_json(message, attachment) do
    """
    {"id":#{json_string(attachment.id)},"filename":#{json_string(attachment.filename)},"content_type":#{json_string(attachment.content_type)},"byte_size":#{attachment.byte_size},"url":#{json_string(Ooolala.Attachment.download_path(message.id, attachment))}}
    """
    |> String.trim()
  end

  defp legacy_attachments(%{attachments: []}), do: ""

  defp legacy_attachments(message) do
    message.attachments
    |> Enum.map(fn attachment ->
      " [attachment #{attachment.filename} #{message.id}/#{attachment.id}]"
    end)
    |> Enum.join("")
  end

  defp peers_json(peers) do
    "{\"peers\":[" <> (peers |> Enum.map(&json_string/1) |> Enum.join(",")) <> "]}"
  end

  defp chat_json(chat) do
    "{\"peer\":#{json_string(chat.peer)},\"room\":#{json_string(chat.room)}}"
  end

  defp version_json(vector) do
    """
    {"product_version":#{json_string(vector.product_version)},"commit":#{json_string(vector.commit)},"environment":#{json_string(vector.environment)},"cli_contract":#{vector.cli_contract},"chat_protocol":{"min":#{vector.chat_protocol.min},"max":#{vector.chat_protocol.max}},"db_schema":{"current":#{vector.db_schema.current},"latest":#{vector.db_schema.latest},"store":#{json_string(vector.db_schema.store)}},"auth_policy":#{vector.auth_policy},"ui_flow":#{vector.ui_flow}}
    """
    |> String.trim()
  end

  defp json_string(value) do
    escaped =
      value
      |> to_string()
      |> String.replace("\\", "\\\\")
      |> String.replace("\"", "\\\"")
      |> String.replace("\n", "\\n")
      |> String.replace("\r", "\\r")
      |> String.replace("\t", "\\t")

    "\"#{escaped}\""
  end

  defp header_filename(filename) do
    filename
    |> to_string()
    |> String.replace("\\", "\\\\")
    |> String.replace("\"", "\\\"")
    |> String.replace(~r/[\r\n]/, "")
  end

  defp response(status, content_type, body, extra_headers \\ []) do
    reason =
      case status do
        200 -> "OK"
        204 -> "No Content"
        201 -> "Created"
        400 -> "Bad Request"
        401 -> "Unauthorized"
        403 -> "Forbidden"
        404 -> "Not Found"
        409 -> "Conflict"
        413 -> "Payload Too Large"
        429 -> "Too Many Requests"
        503 -> "Service Unavailable"
      end

    headers =
      extra_headers
      |> Enum.map(fn {key, value} -> "#{key}: #{value}\r\n" end)

    [
      "HTTP/1.1 #{status} #{reason}\r\n",
      "content-type: #{content_type}\r\n",
      "content-length: #{byte_size(body)}\r\n",
      headers,
      "access-control-allow-origin: *\r\n",
      "access-control-allow-methods: GET, POST, DELETE, OPTIONS\r\n",
      "access-control-allow-headers: authorization, content-type\r\n",
      "connection: close\r\n",
      "\r\n",
      body
    ]
  end

  defp password_error do
    "password must be at least #{Ooolala.Auth.password_min_length()} characters\n"
  end
end
