defmodule OoolalaTest do
  use ExUnit.Case

  setup do
    Ooolala.AuthStore.reset()
    Ooolala.RoomStore.reset()
    :ok
  end

  test "stores messages through the backend boundary" do
    body =
      "backend online with a long enough body to exercise durable transcript parsing " <>
        "after Postgres encodes and returns message text from the append log"

    {:ok, message} = Ooolala.send("general", "ryan", body)

    assert message.body == body
    assert "general" in Ooolala.rooms()
    assert Ooolala.messages("general") == [message]
  end

  test "authenticates seeded development users" do
    assert {:ok, %{username: "user1"}} = Ooolala.login("user1", "1234")
    assert {:ok, %{username: "user2"}} = Ooolala.login("user2", "1234")
    assert {:ok, %{username: "bob"}} = Ooolala.login("bob", "1234")
    assert {:error, :invalid_credentials} = Ooolala.login("user1", "wrong")
  end

  test "allows open signup in dev and keeps username handles permanent" do
    password = "correct horse battery"

    assert {:ok, %{username: "newuser"}} = Ooolala.signup_username("NewUser")
    assert {:ok, %{username: "newuser"}} = Ooolala.signup("NewUser", password)
    assert {:ok, %{username: "newuser"}} = Ooolala.login("newuser", password)
    assert {:error, :username_taken} = Ooolala.signup_username("newuser")
    assert {:error, :username_taken} = Ooolala.signup("newuser", "long enough password")
    assert {:error, :invalid_username} = Ooolala.signup("bad user", password)
    assert {:error, :invalid_password} = Ooolala.signup("shortpass", "123")
  end

  test "can keep signup disabled until promotion" do
    previous = System.get_env("OOOLALA_OPEN_SIGNUP")

    try do
      System.put_env("OOOLALA_OPEN_SIGNUP", "0")
      assert {:error, :username_taken} = Ooolala.signup_username("user1")
      assert {:error, :signup_disabled} = Ooolala.signup("closeduser", "long enough password")
    after
      if previous do
        System.put_env("OOOLALA_OPEN_SIGNUP", previous)
      else
        System.delete_env("OOOLALA_OPEN_SIGNUP")
      end
    end
  end

  test "lets users change only their password" do
    assert {:ok, %{username: "fresh"}} = Ooolala.signup("fresh", "first good password")

    assert {:ok, %{username: "fresh"}} =
             Ooolala.change_password("fresh", "first good password", "second good password")

    assert {:error, :invalid_credentials} = Ooolala.login("fresh", "first good password")
    assert {:ok, %{username: "fresh"}} = Ooolala.login("fresh", "second good password")

    assert {:error, :invalid_credentials} =
             Ooolala.change_password("fresh", "wrong", "third good password")

    assert {:error, :invalid_password} =
             Ooolala.change_password("fresh", "second good password", "999")
  end

  test "reports the compatibility vector" do
    vector = Ooolala.version_vector()

    assert vector.product_version =~ ~r/^\d+\.\d+\.\d+$/
    assert vector.cli_contract == 7
    assert vector.chat_protocol == %{min: 1, max: 3}
    assert vector.db_schema.latest == 7
    assert vector.db_schema.store in ["memory", "postgres"]
    assert vector.auth_policy == 7
    assert vector.ui_flow == 11
  end

  test "direct messages require a known recipient username" do
    assert Ooolala.dm_peers("user1") == []

    assert {:ok, message} = Ooolala.send_dm("user1", "user2", "hello")
    assert message.room == "dm:user1:user2"
    assert message.author == "user1"

    assert {:ok, [^message]} = Ooolala.dm_messages("user2", "user1")
    assert {:ok, _message} = Ooolala.send_dm("user1", "bob", "hello")
    assert Ooolala.dm_peers("user1") == ["bob", "user2"]
    assert Ooolala.dm_peers("user2") == ["user1"]
    assert {:error, :self_recipient} = Ooolala.send_dm("user1", "user1", "nope")
    assert {:error, :unknown_recipient} = Ooolala.send_dm("user1", "missing", "nope")
  end

  test "direct chat list persists initiated chats and supports per-user removal" do
    assert {:ok, %{peer: "user2", room: "dm:user1:user2"}} = Ooolala.start_dm("user1", "user2")
    assert Ooolala.dm_peers("user1") == ["user2"]
    assert Ooolala.dm_peers("user2") == []
    assert {:ok, []} = Ooolala.dm_messages("user1", "user2")

    assert :ok = Ooolala.remove_dm("user1", "user2")
    assert Ooolala.dm_peers("user1") == []

    assert {:ok, message} = Ooolala.send_dm("user2", "user1", "hello")
    assert message.room == "dm:user1:user2"
    assert Ooolala.dm_peers("user1") == ["user2"]
    assert Ooolala.dm_peers("user2") == ["user1"]
  end

  test "direct messages can carry downloadable attachments" do
    assert {:ok, message} =
             Ooolala.send_dm("user1", "user2", "see attached", [
               %{filename: "../note.txt", content_type: "text/plain", data: "hello file"}
             ])

    assert [%{id: attachment_id, filename: "note.txt", byte_size: 10}] = message.attachments

    assert {:ok, attachment} = Ooolala.attachment("user2", message.id, attachment_id)
    assert attachment.filename == "note.txt"
    assert attachment.content_type == "text/plain"
    assert attachment.data == "hello file"

    assert {:error, :attachment_not_found} = Ooolala.attachment("bob", message.id, attachment_id)
  end

  test "disabled users cannot login, send, or receive direct messages" do
    assert {:ok, %{username: "user2"}} = Ooolala.Admin.disable_user("user2", "test")

    assert {:error, :invalid_credentials} = Ooolala.login("user2", "1234")
    assert {:error, :unknown_user} = Ooolala.send_dm("user2", "user1", "blocked sender")
    assert {:error, :unknown_recipient} = Ooolala.send_dm("user1", "user2", "blocked recipient")

    assert {:ok, %{username: "user2"}} = Ooolala.Admin.enable_user("user2")
    assert {:ok, %{username: "user2"}} = Ooolala.login("user2", "1234")
  end

  test "message safety limits are enforced before append" do
    previous_count = System.get_env("OOOLALA_MESSAGE_RATE_LIMIT_COUNT")
    previous_window = System.get_env("OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS")
    previous_bytes = System.get_env("OOOLALA_MAX_MESSAGE_BYTES")

    try do
      System.put_env("OOOLALA_MESSAGE_RATE_LIMIT_COUNT", "2")
      System.put_env("OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS", "60")
      System.put_env("OOOLALA_MAX_MESSAGE_BYTES", "6")

      assert {:ok, _message} = Ooolala.send_dm("user1", "user2", "hello")
      assert {:error, :body_too_large} = Ooolala.send_dm("user1", "user2", "too long")
      assert {:ok, _message} = Ooolala.send_dm("user1", "user2", "again")
      assert {:error, :rate_limited} = Ooolala.send_dm("user1", "user2", "third")
    after
      restore_env("OOOLALA_MESSAGE_RATE_LIMIT_COUNT", previous_count)
      restore_env("OOOLALA_MESSAGE_RATE_LIMIT_WINDOW_SECONDS", previous_window)
      restore_env("OOOLALA_MAX_MESSAGE_BYTES", previous_bytes)
    end
  end

  defp restore_env(name, nil), do: System.delete_env(name)
  defp restore_env(name, value), do: System.put_env(name, value)
end
