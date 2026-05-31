defmodule Ooolala.PostgresAdapterTest do
  use ExUnit.Case, async: false

  setup do
    Ooolala.AuthStore.reset()
    Ooolala.RoomStore.reset()
    :ok
  end

  test "postgres rows survive apostrophes, separators, and sql-shaped text" do
    if postgres?() do
      room = "team's" <> <<0x1F>> <> "room" <> <<0x1E>>
      author = "codex'agent" <> <<0x1F>> <> "writer"
      body = "hello '); DROP TABLE messages; -- " <> <<0x1F, 0x1E>> <> " still here"

      assert {:ok, message} = Ooolala.RoomStore.send_message(room, author, body)
      assert message.room == room
      assert message.author == author
      assert message.body == body

      assert [stored] = Ooolala.RoomStore.list_messages(room)
      assert stored.room == room
      assert stored.author == author
      assert stored.body == body
      assert room in Ooolala.RoomStore.list_rooms()
      assert :ok = Ooolala.RoomStore.health()
    end
  end

  test "postgres attachments preserve arbitrary bytes" do
    if postgres?() do
      data = <<0, 1, 30, 31, 39, 255>>

      assert {:ok, message} =
               Ooolala.send("binary-room", "user'one", "", [
                 %{filename: "odd'name.bin", content_type: "application/octet-stream", data: data}
               ])

      assert [%{id: attachment_id, filename: "odd'name.bin", byte_size: 6}] = message.attachments
      assert {:ok, attachment} = Ooolala.RoomStore.attachment(message.id, attachment_id)
      assert attachment.filename == "odd'name.bin"
      assert attachment.content_type == "application/octet-stream"
      assert attachment.byte_size == 6
      assert attachment.data == data
    end
  end

  defp postgres?, do: Ooolala.RoomStore.store_mode() == :postgres
end
