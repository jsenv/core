import { assert } from "@jsenv/assert";
import { humanize } from "@jsenv/humanize";

{
  const actual = humanize(Symbol());
  const expect = "Symbol()";
  assert({ actual, expect });
}

{
  const actual = humanize(Symbol("foo"));
  const expect = `Symbol("foo")`;
  assert({ actual, expect });
}

{
  const actual = humanize(Symbol(42));
  const expect = `Symbol("42")`;
  assert({ actual, expect });
}
