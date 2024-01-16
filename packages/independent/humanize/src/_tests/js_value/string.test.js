import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(String.fromCharCode(127));
  const expected = `"\\x7F"`;
  assert({ actual, expected });
}

{
  const actual = humanize("");
  const expected = `""`;
  assert({ actual, expected });
}

{
  const actual = humanize("dam");
  const expected = `"dam"`;
  assert({ actual, expected });
}

{
  const actual = humanize("don't");
  const expected = `"don't"`;
  assert({ actual, expected });
}

{
  const actual = humanize("don't", { quote: "'" });
  const expected = `'don\\\'t'`;
  assert({ actual, expected });
}

{
  const actual = humanize(`his name is "dam"`);
  const expected = `'his name is "dam"'`;
  assert({ actual, expected });
}

{
  const actual = humanize(`his name is "dam"`, { quote: "'" });
  const expected = `'his name is "dam"'`;
  assert({ actual, expected });
}

{
  const actual = humanize("a\nb");
  const expected = `"a\\nb"`;
  assert({ actual, expected });
}

{
  const actual = humanize("a\rb");
  const expected = `"a\\rb"`;
  assert({ actual, expected });
}

{
  const actual = humanize("a\u2028b");
  const expected = `"a\\u2028b"`;
  assert({ actual, expected });
}

{
  const actual = humanize("a\u2029b");
  const expected = `"a\\u2029b"`;
  assert({ actual, expected });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new String(""));
  const expected = `String("")`;
  assert({
    actual,
    expected,
  });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new String("dam"));
  const expected = `String("dam")`;
  assert({
    actual,
    expected,
  });
}

{
  const actual = humanize("dam", { quote: "'" });
  const expected = `'dam'`;
  assert({ actual, expected });
}

{
  const actual = humanize(`\`"'`);
  const expected = `"\`\\\"'"`;
  assert({ actual, expected });
}

{
  const actual = humanize(`""''`);
  const expected = `\`""''\``;
  assert({ actual, expected });
}
