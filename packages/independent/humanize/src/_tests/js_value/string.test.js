import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(String.fromCharCode(127));
  const expect = `"\\x7F"`;
  assert({ actual, expect });
}

{
  const actual = humanize("");
  const expect = `""`;
  assert({ actual, expect });
}

{
  const actual = humanize("dam");
  const expect = `"dam"`;
  assert({ actual, expect });
}

{
  const actual = humanize("don't");
  const expect = `"don't"`;
  assert({ actual, expect });
}

{
  const actual = humanize("don't", { quote: "'" });
  const expect = `'don\\\'t'`;
  assert({ actual, expect });
}

{
  const actual = humanize(`his name is "dam"`);
  const expect = `'his name is "dam"'`;
  assert({ actual, expect });
}

{
  const actual = humanize(`his name is "dam"`, { quote: "'" });
  const expect = `'his name is "dam"'`;
  assert({ actual, expect });
}

{
  const actual = humanize("a\nb");
  const expect = `"a\\nb"`;
  assert({ actual, expect });
}

{
  const actual = humanize("a\rb");
  const expect = `"a\\rb"`;
  assert({ actual, expect });
}

{
  const actual = humanize("a\u2028b");
  const expect = `"a\\u2028b"`;
  assert({ actual, expect });
}

{
  const actual = humanize("a\u2029b");
  const expect = `"a\\u2029b"`;
  assert({ actual, expect });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new String(""));
  const expect = `String("")`;
  assert({
    actual,
    expect,
  });
}

{
  // eslint-disable-next-line no-new-wrappers
  const actual = humanize(new String("dam"));
  const expect = `String("dam")`;
  assert({
    actual,
    expect,
  });
}

{
  const actual = humanize("dam", { quote: "'" });
  const expect = `'dam'`;
  assert({ actual, expect });
}

{
  const actual = humanize(`\`"'`);
  const expect = `"\`\\\"'"`;
  assert({ actual, expect });
}

{
  const actual = humanize(`""''`);
  const expect = `\`""''\``;
  assert({ actual, expect });
}
