import { assert } from "@jsenv/assert";
import { inspect } from "@jsenv/inspect";

{
  const actual = inspect(String.fromCharCode(127));
  const expected = `"\\x7F"`;
  assert({ actual, expected });
}

{
  const actual = inspect("");
  const expected = `""`;
  assert({ actual, expected });
}

{
  const actual = inspect("dam");
  const expected = `"dam"`;
  assert({ actual, expected });
}

{
  const actual = inspect("don't");
  const expected = `"don't"`;
  assert({ actual, expected });
}

{
  const actual = inspect("don't", { quote: "'" });
  const expected = `'don\\\'t'`;
  assert({ actual, expected });
}

{
  const actual = inspect(`his name is "dam"`);
  const expected = `'his name is "dam"'`;
  assert({ actual, expected });
}

{
  const actual = inspect(`his name is "dam"`, { quote: "'" });
  const expected = `'his name is "dam"'`;
  assert({ actual, expected });
}

{
  const actual = inspect("a\nb");
  const expected = `"a\\nb"`;
  assert({ actual, expected });
}

{
  const actual = inspect("a\rb");
  const expected = `"a\\rb"`;
  assert({ actual, expected });
}

{
  const actual = inspect("a\u2028b");
  const expected = `"a\\u2028b"`;
  assert({ actual, expected });
}

{
  const actual = inspect("a\u2029b");
  const expected = `"a\\u2029b"`;
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new String(""));
  const expected = `String("")`;
  assert({
    actual,
    expected,
  });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = inspect(new String("dam"));
  const expected = `String("dam")`;
  assert({
    actual,
    expected,
  });
}

{
  const actual = inspect("dam", { quote: "'" });
  const expected = `'dam'`;
  assert({ actual, expected });
}

{
  const actual = inspect(`\`"'`);
  const expected = `"\`\\\"'"`;
  assert({ actual, expected });
}

{
  const actual = inspect(`""''`);
  const expected = `\`""''\``;
  assert({ actual, expected });
}
