defmodule OoolalaChatTest do
  use ExUnit.Case

  alias Ooolala.Chat
  alias Ooolala.Version

  test "sends and lists room messages" do
    {:ok, message, state} = Chat.send_message(Chat.new_state(), "general", "ryan", "hello")

    assert message.room == "general"
    assert message.author == "ryan"
    assert message.body == "hello"
    assert Chat.list_rooms(state) == ["general"]
    assert Chat.list_messages(state, "general") == [message]
  end

  test "exposes monotonic compatibility contracts" do
    assert Version.product_version() =~ ~r/^\d+\.\d+\.\d+$/
    assert Version.cli_contract() == 7
    assert Version.chat_protocol_min() == 1
    assert Version.chat_protocol_max() == 3
    assert Version.db_schema() == 7
    assert Version.auth_policy() == 7
    assert Version.ui_flow() == 11
  end
end
