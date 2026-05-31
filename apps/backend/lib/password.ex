defmodule Ooolala.Password do
  @moduledoc "Small PBKDF2 password hashing helper for the dev auth store."

  import Bitwise

  @algorithm "pbkdf2_sha256"
  @iterations 120_000
  @key_length 32
  @salt_length 16

  def hash(password, opts \\ []) do
    iterations = Keyword.get(opts, :iterations, @iterations)
    salt = Keyword.get(opts, :salt, :crypto.strong_rand_bytes(@salt_length))
    password = to_string(password)

    digest = derive(password, salt, iterations)

    [
      @algorithm,
      Integer.to_string(iterations),
      Base.url_encode64(salt, padding: false),
      Base.url_encode64(digest, padding: false)
    ]
    |> Enum.join("$")
  end

  def verify(password, stored_hash) do
    with [@algorithm, iterations_text, salt_text, digest_text] <-
           String.split(to_string(stored_hash), "$"),
         {iterations, ""} <- Integer.parse(iterations_text),
         {:ok, salt} <- Base.url_decode64(salt_text, padding: false),
         {:ok, digest} <- Base.url_decode64(digest_text, padding: false) do
      password
      |> to_string()
      |> derive(salt, iterations)
      |> secure_compare(digest)
    else
      _ -> false
    end
  end

  defp derive(password, salt, iterations) do
    :crypto.pbkdf2_hmac(:sha256, password, salt, iterations, @key_length)
  end

  defp secure_compare(left, right) when byte_size(left) == byte_size(right) do
    left
    |> :crypto.exor(right)
    |> :binary.bin_to_list()
    |> Enum.reduce(0, fn byte, acc -> acc ||| byte end)
    |> Kernel.==(0)
  end

  defp secure_compare(_left, _right), do: false
end
