import { assert } from "@jsenv/assert";

import { parseAnsi } from "@jsenv/terminal-to-svg/src/parse_ansi.js";

// reset bold
{
  const text = `\u001B[1m BOLD\u001B[0m NORMAL`;
  const { chunks } = parseAnsi(text);
  const actual = chunks[3].style;
  const expected = {};
  assert({ actual, expected });
}
// measure text area
{
  const text = "012\n345\n678";
  const { columns, rows } = parseAnsi(text);
  const actual = { columns, rows };
  const expected = { columns: 3, rows: 3 };
  assert({ actual, expected });
}
// gets raw ansi
{
  const text = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  const { raw } = parseAnsi(text);
  const actual = raw;
  const expected = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  assert({ actual, expected });
}
// plaintext
{
  const text = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  const { plainText } = parseAnsi(text);
  const actual = plainText;
  const expected = "🤖 DANGER Will Robbinson";
  assert({ actual, expected });
}
