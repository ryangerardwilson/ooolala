defmodule Ooolala.HttpServerTest do
  use ExUnit.Case, async: false

  setup do
    previous_env =
      snapshot_env(["PORT", "OOOLALA_MAX_HTTP_BODY_BYTES", "OOOLALA_MAX_HTTP_HEADER_BYTES"])

    port = free_port()

    System.put_env("PORT", Integer.to_string(port))
    Ooolala.AuthStore.reset()
    Ooolala.RoomStore.reset()
    start_supervised!(Ooolala.HttpServer)

    on_exit(fn -> restore_env(previous_env) end)

    {:ok, port: port}
  end

  test "cors preflight succeeds and malformed requests fail closed", %{port: port} do
    preflight = request(port, "OPTIONS /anything HTTP/1.1\r\nhost: local\r\n\r\n")

    assert preflight =~ "HTTP/1.1 204 No Content"
    assert preflight =~ "access-control-allow-methods: GET, POST, DELETE, OPTIONS"
    assert preflight =~ "access-control-allow-headers: authorization, content-type"

    malformed = request(port, "not-http\r\n\r\n")

    assert malformed =~ "HTTP/1.1 400 Bad Request"
    assert malformed =~ "bad request\n"
  end

  test "authenticated routes reject missing and invalid basic auth", %{port: port} do
    missing = request(port, "GET /dm?with=user2 HTTP/1.1\r\nhost: local\r\n\r\n")

    assert missing =~ "HTTP/1.1 401 Unauthorized"
    assert missing =~ "invalid credentials\n"

    invalid =
      request(
        port,
        "GET /dm?with=user2 HTTP/1.1\r\n" <>
          "host: local\r\n" <>
          "authorization: Basic #{Base.encode64("user1:wrong")}\r\n" <>
          "\r\n"
      )

    assert invalid =~ "HTTP/1.1 401 Unauthorized"
    assert invalid =~ "invalid credentials\n"
  end

  test "json responses escape the full control-character surface", %{port: port} do
    body = "line\nquote\"slash\\tab\tctrl" <> <<1>>

    response =
      post_form(port, "/dm", %{
        "to" => "user2",
        "body" => body,
        "format" => "json"
      })

    assert response =~ "HTTP/1.1 200 OK"
    assert response =~ "line\\nquote\\\"slash\\\\tab\\tctrl\\u0001"
    refute response =~ <<1>>
  end

  test "attachment downloads keep safe content and disposition headers", %{port: port} do
    assert {:ok, message} =
             Ooolala.send_dm("user1", "user2", "see attached", [
               %{filename: "bad\"name.txt\n", content_type: "text/plain", data: "hello file"}
             ])

    assert [%{id: attachment_id}] = message.attachments

    response =
      request(
        port,
        "GET /attachments/#{message.id}/#{attachment_id} HTTP/1.1\r\n" <>
          "host: local\r\n" <>
          "authorization: Basic #{Base.encode64("user2:1234")}\r\n" <>
          "\r\n"
      )

    assert response =~ "HTTP/1.1 200 OK"
    assert response =~ "content-type: text/plain"
    assert response =~ "content-disposition: attachment; filename=\"bad\\\"name.txt\""
    assert String.ends_with?(response, "\r\n\r\nhello file")
  end

  test "backend request caps reject oversized bodies and headers", %{port: port} do
    System.put_env("OOOLALA_MAX_HTTP_BODY_BYTES", "8")

    oversized_body =
      post_form(port, "/login", %{
        "username" => "user1",
        "password" => "1234"
      })

    assert oversized_body =~ "HTTP/1.1 413 Payload Too Large"
    assert oversized_body =~ "request too large\n"

    System.put_env("OOOLALA_MAX_HTTP_HEADER_BYTES", "64")

    oversized_header =
      request(
        port,
        "GET /health HTTP/1.1\r\nhost: local\r\nx-fill: #{String.duplicate("x", 120)}\r\n\r\n"
      )

    assert oversized_header =~ "HTTP/1.1 413 Payload Too Large"
    assert oversized_header =~ "request too large\n"
  end

  defp post_form(port, path, params) do
    body = URI.encode_query(params)

    request(
      port,
      "POST #{path} HTTP/1.1\r\n" <>
        "host: local\r\n" <>
        "authorization: Basic #{Base.encode64("user1:1234")}\r\n" <>
        "content-type: application/x-www-form-urlencoded\r\n" <>
        "content-length: #{byte_size(body)}\r\n" <>
        "\r\n" <>
        body
    )
  end

  defp request(port, request) do
    {:ok, socket} = :gen_tcp.connect({127, 0, 0, 1}, port, [:binary, active: false], 1_000)
    :ok = :gen_tcp.send(socket, request)
    response = recv_all(socket, "")
    :gen_tcp.close(socket)
    response
  end

  defp recv_all(socket, acc) do
    case :gen_tcp.recv(socket, 0, 1_000) do
      {:ok, chunk} -> recv_all(socket, acc <> chunk)
      {:error, :closed} -> acc
      {:error, :timeout} -> acc
    end
  end

  defp free_port do
    {:ok, socket} = :gen_tcp.listen(0, [:binary, active: false, reuseaddr: true])
    {:ok, port} = :inet.port(socket)
    :gen_tcp.close(socket)
    port
  end

  defp snapshot_env(names), do: Map.new(names, &{&1, System.get_env(&1)})

  defp restore_env(snapshot) do
    Enum.each(snapshot, fn
      {name, nil} -> System.delete_env(name)
      {name, value} -> System.put_env(name, value)
    end)
  end
end
