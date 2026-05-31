const lines = [
  'ooolala  chats',
  '',
  '-- Today --',
  '',
  'hello from the CLI',
  '[1:24 pm]',
  '',
  '                                           backend target: elixir release on vm',
  '                                                                    [1:25 pm]',
  '',
  ' > _'
];

process.stdout.write(`${lines.join('\n')}\n`);
