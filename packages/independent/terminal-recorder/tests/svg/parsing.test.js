import { assert } from "@jsenv/assert";

import { parseAnsi } from "@jsenv/terminal-recorder/src/svg/parse_ansi.js";

// reset bold
{
  const text = `\u001B[1m BOLD\u001B[0m NORMAL`;
  const { chunks } = parseAnsi(text);
  const actual = chunks[3].style;
  const expect = {};
  assert({ actual, expect });
}
// measure text area
{
  const text = "012\n345\n678";
  const { columns, rows } = parseAnsi(text);
  const actual = { columns, rows };
  const expect = { columns: 3, rows: 3 };
  assert({ actual, expect });
}
// gets raw ansi
{
  const text = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  const { raw } = parseAnsi(text);
  const actual = raw;
  const expect = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  assert({ actual, expect });
}
// plaintext
{
  const text = "🤖\u001B[31m DANGER\u001B[0m Will Robbinson";
  const { plainText } = parseAnsi(text);
  const actual = plainText;
  const expect = "🤖 DANGER Will Robbinson";
  assert({ actual, expect });
}
