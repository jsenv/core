import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(Symbol());
  const expected = "Symbol()";
  assert({ actual, expected });
}

{
  const actual = humanize(Symbol("foo"));
  const expected = `Symbol("foo")`;
  assert({ actual, expected });
}

{
  const actual = humanize(Symbol(42));
  const expected = `Symbol("42")`;
  assert({ actual, expected });
}
